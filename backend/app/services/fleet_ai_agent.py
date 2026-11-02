"""
services/fleet_ai_agent.py
Core Agent abstraction for the Fleet AI Intelligence using Gemini API.

Timeout budget (fleet-copilot frontend timeout = 90 s, backend target ≤ 82 s):
  - Per-call Gemini timeout : 25 000 ms
  - Primary attempts        : 2  (backoff ~1–1.5 s between them)
  - Fallback attempts       : 1  (only when primary returns 429/503)
  - Worst-case              : 25 + 1.5 + 25 + 25 = 51.5 s  < 82 s  ✓
"""

import json
import logging
import random
import time
from typing import Dict, Any, Optional, List

from google import genai
from google.genai import types
from google.genai.errors import APIError
from app.config import settings

from app.services.fleet_ai_tools import (
    get_fleet_summary,
    get_fleet_soh_overview,
    get_vehicle_comparison,
    get_vehicle_summary,
)

logger = logging.getLogger(__name__)

_RETRYABLE_CODES = frozenset({429, 503, 504})
_MAX_PRIMARY_ATTEMPTS = 2
# Per-call Gemini timeout in milliseconds.
# 25 000 ms × 2 attempts + ~1.5 s backoff + 25 000 ms fallback = ~51.5 s
# comfortably inside the 82 s backend budget (90 s frontend − 8 s margin).
_GEMINI_TIMEOUT_MS = 25_000


# ---------------------------------------------------------------------------
# Shared Gemini helpers
# ---------------------------------------------------------------------------

def _call_gemini(client: genai.Client, model: str, prompt: str) -> str:
    """Single synchronous Gemini call. Returns stripped text or raises."""
    config = types.GenerateContentConfig(
        http_options=types.HttpOptions(timeout=_GEMINI_TIMEOUT_MS)
    )
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=config,
    )
    if not response.text:
        raise ValueError("Empty AI response")
    return response.text.strip()


def _gemini_with_fallback(prompt: str) -> tuple[str, str]:
    """
    Calls Gemini with retry + optional fallback.

    Retry policy:
      - Retries only on retryable HTTP codes (429, 503).
      - Non-retryable errors fail fast (no retry).
      - Fallback model is skipped when it is identical to the primary.
      - At most 2 primary attempts + 1 fallback attempt.

    Returns:
        (response_text, model_name_used)

    Raises:
        RuntimeError: safe user-facing message when all attempts fail.
    """
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    primary = settings.GEMINI_MODEL
    fallback = settings.GEMINI_FALLBACK_MODEL
    last_err: Exception | None = None

    for attempt in range(_MAX_PRIMARY_ATTEMPTS):
        if attempt > 0:
            delay = 1.0 * (2 ** (attempt - 1)) + random.uniform(0, 0.5)
            logger.warning(
                "Fleet Gemini primary attempt %d/%d failed (code=%s); retrying %s in %.1fs",
                attempt, _MAX_PRIMARY_ATTEMPTS,
                getattr(last_err, "code", "?"),
                primary, delay,
            )
            time.sleep(delay)

        try:
            text = _call_gemini(client, primary, prompt)
            logger.info("Fleet Gemini answered via %s", primary)
            return text, primary

        except APIError as e:
            last_err = e
            logger.warning(
                "Fleet Gemini %s attempt %d: code=%s status=%s",
                primary, attempt + 1, e.code, e.status,
            )
            if e.code not in _RETRYABLE_CODES:
                logger.error(
                    "Non-retryable Fleet Gemini error (code=%s); aborting", e.code
                )
                break

        except Exception as e:
            last_err = e
            logger.warning(
                "Fleet Gemini %s attempt %d non-API error: %s",
                primary, attempt + 1, type(e).__name__,
            )
            break

    use_fallback = (
        isinstance(last_err, APIError)
        and last_err.code in _RETRYABLE_CODES
        and fallback
        and fallback != primary
    )
    if use_fallback:
        logger.warning(
            "Fleet falling back from %s to %s after retryable error", primary, fallback
        )
        try:
            text = _call_gemini(client, fallback, prompt)
            logger.info("Fleet Gemini answered via fallback %s", fallback)
            return text, fallback
        except Exception as fb_err:
            logger.exception("Fleet fallback %s also failed: %s", fallback, fb_err)
            last_err = fb_err

    raise RuntimeError("The Fleet AI service is unavailable.") from last_err


# ---------------------------------------------------------------------------
# Prompt builder — unchanged
# ---------------------------------------------------------------------------

def _build_fleet_prompt(
    message: Optional[str], context: Dict[str, Any], run_analysis: bool
) -> str:
    system_instruction = """You are an AI Fleet Intelligence assistant for EV battery fleet management.
Use only the provided retrieved project data for fleet claims.
Never invent measurements, calendar dates, battery faults, or vehicle data.
Never make definitive physical or safety diagnosis.
Distinguish historical SOH (estimated_SOH) from ML predicted SOH (predicted_soh). Historical SOH is measured.
Use EFC as the lifecycle context.
Explain conclusions using retrieved data. Clearly state when available data is insufficient.
Do not reveal internal credentials or database structure.

For fleet questions, structure responses when useful as:
FLEET STATUS
KEY FINDINGS
VEHICLES REQUIRING ATTENTION
WHY
WHAT TO MONITOR
DATA BASIS
Do not force this structure for simple questions.
Keep answers concise enough for a dashboard.
"""

    context_str = json.dumps(context, indent=2, default=str)

    prompt = f"{system_instruction}\n\n"
    prompt += f"--- AUTHORIZED FLEET CONTEXT ---\n{context_str}\n--------------------------------\n\n"

    if run_analysis:
        prompt += "USER REQUEST: Run Fleet AI Analysis thoroughly based on your instructions.\n"
    elif message:
        prompt += f"USER REQUEST: {message}\n"
    else:
        prompt += "USER REQUEST: Summarize the fleet health based on the context.\n"

    return prompt


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_fleet_copilot(
    pg,
    vehicle_ids: Optional[List[str]],
    message: Optional[str],
    run_analysis: bool,
) -> Dict[str, Any]:
    tools_used = []
    gathered_context = {}
    t0 = time.monotonic()

    if vehicle_ids:
        gathered_context["vehicle_comparison"] = get_vehicle_comparison(pg, vehicle_ids)
        tools_used.append("get_vehicle_comparison")

        for vid in vehicle_ids:
            gathered_context[f"summary_{vid}"] = get_vehicle_summary(pg, vid)
            tools_used.append(f"get_vehicle_summary_{vid}")
    else:
        gathered_context["fleet_summary"] = get_fleet_summary(pg)
        tools_used.append("get_fleet_summary")

        gathered_context["fleet_soh_overview"] = get_fleet_soh_overview(pg)
        tools_used.append("get_fleet_soh_overview")

    logger.info(
        "fleet copilot context gathered - tools: %s (%.2fs)",
        tools_used, time.monotonic() - t0,
    )

    if not settings.GEMINI_API_KEY:
        raise NotImplementedError(
            "LLM Provider is not configured. Context gathered: " + ", ".join(tools_used)
        )

    prompt = _build_fleet_prompt(message, gathered_context, run_analysis)

    try:
        answer, model_used = _gemini_with_fallback(prompt)
        logger.info(
            "fleet copilot complete via %s in %.2fs", model_used, time.monotonic() - t0
        )
        return {"answer": answer, "tools_used": tools_used}
    except RuntimeError:
        raise
    except Exception as e:
        logger.exception("Unexpected error in run_fleet_copilot: %s", e)
        raise RuntimeError("The Fleet AI service is unavailable.") from e
