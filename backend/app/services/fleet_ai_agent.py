"""
services/fleet_ai_agent.py
Core Agent abstraction for the Fleet AI Intelligence using Gemini API.
"""

import json
from typing import Dict, Any, Optional, List
from google import genai
from app.config import settings

from app.services.fleet_ai_tools import (
    get_fleet_summary,
    get_fleet_soh_overview,
    get_vehicle_comparison,
    get_vehicle_summary
)

def _build_fleet_prompt(message: Optional[str], context: Dict[str, Any], run_analysis: bool) -> str:
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

def run_fleet_copilot(pg, vehicle_ids: Optional[List[str]], message: Optional[str], run_analysis: bool) -> Dict[str, Any]:
    tools_used = []
    gathered_context = {}
    
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
        
    if not settings.GEMINI_API_KEY:
        raise NotImplementedError(
            "LLM Provider is not configured. Context gathered: " + ", ".join(tools_used)
        )
        
    prompt = _build_fleet_prompt(message, gathered_context, run_analysis)
    
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
        )
        if not response.text:
            raise ValueError("Empty AI response")
        return {
            "answer": response.text.strip(),
            "tools_used": tools_used
        }
    except Exception as e:
        raise RuntimeError(f"The Fleet AI service is unavailable: {e}") from e
