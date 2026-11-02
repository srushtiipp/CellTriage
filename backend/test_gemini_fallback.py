"""
test_gemini_fallback.py
Unit tests for the Gemini retry + fallback logic in ai_agent and fleet_ai_agent.

Tests use unittest.mock to simulate 503 responses without real network calls
or invalid model names. The 503 -> success fallback path is the primary scenario.

Run with:
    python -m pytest test_gemini_fallback.py -v
or:
    python test_gemini_fallback.py
"""
import sys
import types as builtin_types
import unittest
from unittest.mock import MagicMock, patch, call


# ---------------------------------------------------------------------------
# Minimal SDK stubs so tests run without a real google-genai installation
# ---------------------------------------------------------------------------

def _make_sdk_stubs():
    """Create lightweight stubs for google.genai and google.genai.errors."""
    # google package
    google_mod = builtin_types.ModuleType("google")
    genai_mod = builtin_types.ModuleType("google.genai")
    errors_mod = builtin_types.ModuleType("google.genai.errors")
    types_mod = builtin_types.ModuleType("google.genai.types")

    # Minimal APIError hierarchy
    class APIError(Exception):
        def __init__(self, code, status=""):
            self.code = code
            self.status = status
            super().__init__(f"{code} {status}")

    class ServerError(APIError):
        pass

    class ClientError(APIError):
        pass

    errors_mod.APIError = APIError
    errors_mod.ServerError = ServerError
    errors_mod.ClientError = ClientError

    # Minimal types stubs (dataclass-like)
    class HttpOptions:
        def __init__(self, timeout=None):
            self.timeout = timeout

    class GenerateContentConfig:
        def __init__(self, http_options=None, **_):
            self.http_options = http_options

    types_mod.HttpOptions = HttpOptions
    types_mod.GenerateContentConfig = GenerateContentConfig

    # Minimal Client stub
    class Client:
        def __init__(self, api_key=""):
            self.api_key = api_key
            self.models = MagicMock()

    genai_mod.Client = Client
    genai_mod.errors = errors_mod
    genai_mod.types = types_mod

    google_mod.genai = genai_mod

    # Patch sys.modules so imports inside the agent files resolve
    sys.modules.setdefault("google", google_mod)
    sys.modules.setdefault("google.genai", genai_mod)
    sys.modules.setdefault("google.genai.errors", errors_mod)
    sys.modules.setdefault("google.genai.types", types_mod)

    return genai_mod, errors_mod, types_mod


_genai_stub, _errors_stub, _types_stub = _make_sdk_stubs()
APIError = _errors_stub.APIError
ServerError = _errors_stub.ServerError


# ---------------------------------------------------------------------------
# Patch app.config before importing agents
# ---------------------------------------------------------------------------

class _FakeSettings:
    GEMINI_API_KEY = "test-key"
    GEMINI_MODEL = "gemini-3.8-flash"
    GEMINI_FALLBACK_MODEL = "gemini-2.5-flash"


_fake_config = builtin_types.ModuleType("app.config")
_fake_config.settings = _FakeSettings()
sys.modules["app.config"] = _fake_config

# Stub out tool modules so agent imports don't need a real DB
for _mod_name in [
    "app.services.ai_tools",
    "app.services.fleet_ai_tools",
]:
    _m = builtin_types.ModuleType(_mod_name)
    for _fn in [
        "get_vehicle_summary", "get_health_history",
        "get_battery_metrics", "get_health_trend",
        "get_fleet_summary", "get_fleet_soh_overview",
        "get_vehicle_comparison",
    ]:
        setattr(_m, _fn, MagicMock(return_value={}))
    sys.modules[_mod_name] = _m

# Now safe to import
from app.services.ai_agent import _gemini_with_fallback as user_fallback, _call_gemini as user_call
from app.services.fleet_ai_agent import _gemini_with_fallback as fleet_fallback, _call_gemini as fleet_call


# ---------------------------------------------------------------------------
# Helper to build a mock Gemini response
# ---------------------------------------------------------------------------

def _ok_response(text="Battery health looks good."):
    r = MagicMock()
    r.text = text
    return r


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRetryAndFallback(unittest.TestCase):
    """Tests for the user (vehicle) copilot retry/fallback logic."""

    def _patch_call(self, side_effects):
        """Patch _call_gemini in ai_agent with the given side_effect list."""
        return patch(
            "app.services.ai_agent._call_gemini",
            side_effect=side_effects,
        )

    # ------------------------------------------------------------------
    # Scenario 1: Primary succeeds on first attempt — no retry, no fallback
    # ------------------------------------------------------------------
    def test_primary_succeeds_first_attempt(self):
        with self._patch_call(["The battery is healthy."]):
            text, model = user_fallback("prompt", "VH-001")
        self.assertEqual(text, "The battery is healthy.")
        self.assertEqual(model, _FakeSettings.GEMINI_MODEL)

    # ------------------------------------------------------------------
    # Scenario 2: Primary returns 503 on attempt 1, succeeds on attempt 2
    # ------------------------------------------------------------------
    def test_primary_retries_on_503_then_succeeds(self):
        with self._patch_call([
            ServerError(503, "UNAVAILABLE"),
            "Retry worked.",
        ]), patch("time.sleep"):
            text, model = user_fallback("prompt", "VH-001")
        self.assertEqual(text, "Retry worked.")
        self.assertEqual(model, _FakeSettings.GEMINI_MODEL)

    # ------------------------------------------------------------------
    # Scenario 3: Primary 503 twice → fallback succeeds (core scenario)
    # ------------------------------------------------------------------
    def test_503_twice_then_fallback_succeeds(self):
        with self._patch_call([
            ServerError(503, "UNAVAILABLE"),  # primary attempt 1
            ServerError(503, "UNAVAILABLE"),  # primary attempt 2
            "Fallback answer.",               # fallback attempt
        ]), patch("time.sleep"):
            text, model = user_fallback("prompt", "VH-001")
        self.assertEqual(text, "Fallback answer.")
        self.assertEqual(model, _FakeSettings.GEMINI_FALLBACK_MODEL)

    # ------------------------------------------------------------------
    # Scenario 4: 429 (rate-limit) → fallback succeeds
    # ------------------------------------------------------------------
    def test_429_triggers_fallback(self):
        with self._patch_call([
            APIError(429, "RESOURCE_EXHAUSTED"),
            APIError(429, "RESOURCE_EXHAUSTED"),
            "Rate limit fallback.",
        ]), patch("time.sleep"):
            text, model = user_fallback("prompt", "VH-001")
        self.assertEqual(text, "Rate limit fallback.")
        self.assertEqual(model, _FakeSettings.GEMINI_FALLBACK_MODEL)

    # ------------------------------------------------------------------
    # Scenario 5: 404 (invalid model) → fails fast, no retry, no fallback
    # ------------------------------------------------------------------
    def test_404_fails_fast_no_fallback(self):
        mock_call = MagicMock(side_effect=APIError(404, "NOT_FOUND"))
        with patch("app.services.ai_agent._call_gemini", mock_call), \
             patch("time.sleep"):
            with self.assertRaises(RuntimeError):
                user_fallback("prompt", "VH-001")
        # Only 1 call — fast-fail, no retry
        self.assertEqual(mock_call.call_count, 1)

    # ------------------------------------------------------------------
    # Scenario 6: 403 auth error → fails fast
    # ------------------------------------------------------------------
    def test_403_fails_fast(self):
        mock_call = MagicMock(side_effect=APIError(403, "PERMISSION_DENIED"))
        with patch("app.services.ai_agent._call_gemini", mock_call), \
             patch("time.sleep"):
            with self.assertRaises(RuntimeError):
                user_fallback("prompt", "VH-001")
        self.assertEqual(mock_call.call_count, 1)

    # ------------------------------------------------------------------
    # Scenario 7: Both primary and fallback fail → RuntimeError raised
    # ------------------------------------------------------------------
    def test_all_attempts_fail_raises_runtime_error(self):
        with self._patch_call([
            ServerError(503, "UNAVAILABLE"),
            ServerError(503, "UNAVAILABLE"),
            ServerError(503, "UNAVAILABLE"),
        ]), patch("time.sleep"):
            with self.assertRaises(RuntimeError) as ctx:
                user_fallback("prompt", "VH-001")
        self.assertIn("temporarily unavailable", str(ctx.exception))

    # ------------------------------------------------------------------
    # Scenario 8: Fallback skipped when primary == fallback
    # ------------------------------------------------------------------
    def test_fallback_skipped_when_identical_to_primary(self):
        original_fallback = _FakeSettings.GEMINI_FALLBACK_MODEL
        _FakeSettings.GEMINI_FALLBACK_MODEL = _FakeSettings.GEMINI_MODEL  # make them equal
        try:
            mock_call = MagicMock(side_effect=ServerError(503, "UNAVAILABLE"))
            with patch("app.services.ai_agent._call_gemini", mock_call), \
                 patch("time.sleep"):
                with self.assertRaises(RuntimeError):
                    user_fallback("prompt", "VH-001")
            # Only primary attempts — no fallback call
            self.assertEqual(mock_call.call_count, _FakeSettings.GEMINI_MODEL == _FakeSettings.GEMINI_FALLBACK_MODEL and 2 or 3)
            # All calls used primary model name
            for c in mock_call.call_args_list:
                self.assertEqual(c.args[1], _FakeSettings.GEMINI_MODEL)
        finally:
            _FakeSettings.GEMINI_FALLBACK_MODEL = original_fallback

    # ------------------------------------------------------------------
    # Scenario 9: Non-API timeout exception → no retry, no fallback
    # ------------------------------------------------------------------
    def test_network_timeout_no_retry(self):
        mock_call = MagicMock(side_effect=TimeoutError("connect timeout"))
        with patch("app.services.ai_agent._call_gemini", mock_call), \
             patch("time.sleep"):
            with self.assertRaises(RuntimeError):
                user_fallback("prompt", "VH-001")
        # Only 1 call — unexpected errors are not retried
        self.assertEqual(mock_call.call_count, 1)

    # ------------------------------------------------------------------
    # Scenario 10: Backoff sleep is called between primary retry attempts
    # ------------------------------------------------------------------
    def test_backoff_sleep_called_between_retries(self):
        with self._patch_call([
            ServerError(503, "UNAVAILABLE"),
            "Works on retry.",
        ]):
            with patch("time.sleep") as mock_sleep:
                user_fallback("prompt", "VH-001")
        mock_sleep.assert_called_once()
        sleep_duration = mock_sleep.call_args[0][0]
        # Base 1.0 s + jitter [0, 0.5] → between 1.0 and 1.5 s
        self.assertGreaterEqual(sleep_duration, 1.0)
        self.assertLessEqual(sleep_duration, 1.5)


class TestFleetRetryAndFallback(unittest.TestCase):
    """Same scenarios applied to the fleet copilot helper."""

    def _patch_call(self, side_effects):
        return patch(
            "app.services.fleet_ai_agent._call_gemini",
            side_effect=side_effects,
        )

    def test_fleet_primary_succeeds(self):
        with self._patch_call(["Fleet is healthy."]):
            text, model = fleet_fallback("fleet prompt")
        self.assertEqual(model, _FakeSettings.GEMINI_MODEL)

    def test_fleet_503_twice_then_fallback(self):
        with self._patch_call([
            ServerError(503, "UNAVAILABLE"),
            ServerError(503, "UNAVAILABLE"),
            "Fleet fallback answer.",
        ]), patch("time.sleep"):
            text, model = fleet_fallback("fleet prompt")
        self.assertEqual(text, "Fleet fallback answer.")
        self.assertEqual(model, _FakeSettings.GEMINI_FALLBACK_MODEL)

    def test_fleet_404_fails_fast(self):
        mock_call = MagicMock(side_effect=APIError(404, "NOT_FOUND"))
        with patch("app.services.fleet_ai_agent._call_gemini", mock_call), \
             patch("time.sleep"):
            with self.assertRaises(RuntimeError):
                fleet_fallback("fleet prompt")
        self.assertEqual(mock_call.call_count, 1)

    def test_fleet_fallback_skipped_when_same_model(self):
        original = _FakeSettings.GEMINI_FALLBACK_MODEL
        _FakeSettings.GEMINI_FALLBACK_MODEL = _FakeSettings.GEMINI_MODEL
        try:
            mock_call = MagicMock(side_effect=ServerError(503, "UNAVAILABLE"))
            with patch("app.services.fleet_ai_agent._call_gemini", mock_call), \
                 patch("time.sleep"):
                with self.assertRaises(RuntimeError):
                    fleet_fallback("fleet prompt")
            for c in mock_call.call_args_list:
                self.assertEqual(c.args[1], _FakeSettings.GEMINI_MODEL)
        finally:
            _FakeSettings.GEMINI_FALLBACK_MODEL = original

    def test_fleet_504_triggers_fallback(self):
        """Fleet: 504 on both primary attempts → fallback succeeds."""
        with self._patch_call([
            APIError(504, "DEADLINE_EXCEEDED"),
            APIError(504, "DEADLINE_EXCEEDED"),
            "Fleet 504 fallback answer.",
        ]), patch("time.sleep"):
            text, model = fleet_fallback("fleet prompt")
        self.assertEqual(text, "Fleet 504 fallback answer.")
        self.assertEqual(model, _FakeSettings.GEMINI_FALLBACK_MODEL)


# ---------------------------------------------------------------------------
# 504-specific tests (the exact live failure scenario)
# ---------------------------------------------------------------------------

class Test504Fallback(unittest.TestCase):
    """Tests covering the live-observed 503 → 504 → abort bug, now fixed."""

    def _patch_call(self, side_effects):
        return patch(
            "app.services.ai_agent._call_gemini",
            side_effect=side_effects,
        )

    def test_503_then_504_triggers_fallback(self):
        """
        Live scenario: attempt 1 = 503, attempt 2 = 504.
        Before the fix: 504 was non-retryable → abort (bug).
        After the fix:  last error is retryable → fallback is attempted.
        """
        with self._patch_call([
            ServerError(503, "UNAVAILABLE"),      # primary attempt 1
            APIError(504, "DEADLINE_EXCEEDED"),   # primary attempt 2
            "Fallback after mixed errors.",        # fallback attempt
        ]), patch("time.sleep"):
            text, model = user_fallback("prompt", "VH-001")
        self.assertEqual(text, "Fallback after mixed errors.")
        self.assertEqual(model, _FakeSettings.GEMINI_FALLBACK_MODEL)

    def test_504_on_first_attempt_triggers_fallback(self):
        """504 on both primary attempts → fallback succeeds."""
        with self._patch_call([
            APIError(504, "DEADLINE_EXCEEDED"),   # primary attempt 1
            APIError(504, "DEADLINE_EXCEEDED"),   # primary attempt 2
            "504 fallback answer.",               # fallback attempt
        ]), patch("time.sleep"):
            text, model = user_fallback("prompt", "VH-001")
        self.assertEqual(text, "504 fallback answer.")
        self.assertEqual(model, _FakeSettings.GEMINI_FALLBACK_MODEL)

    def test_504_primary_and_fallback_both_fail(self):
        """If fallback also fails after a 504, a safe RuntimeError is returned."""
        with self._patch_call([
            APIError(504, "DEADLINE_EXCEEDED"),   # primary attempt 1
            APIError(504, "DEADLINE_EXCEEDED"),   # primary attempt 2
            APIError(503, "UNAVAILABLE"),          # fallback attempt — also fails
        ]), patch("time.sleep"):
            with self.assertRaises(RuntimeError) as ctx:
                user_fallback("prompt", "VH-001")
        self.assertIn("temporarily unavailable", str(ctx.exception))


# ---------------------------------------------------------------------------
# Direct run support
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(verbosity=2)

