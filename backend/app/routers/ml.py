"""
routers/ml.py
ML prediction endpoints for CellTriage.

Endpoints:
  POST /api/ml/test-predict   - Temporary integration test endpoint.
                                 Accepts a 52-feature JSON body and returns
                                 the model SOH prediction.

This router exists to validate model integration in Step 4.
It is intentionally minimal - full fleet prediction endpoints
(vehicle-scoped, with DB writes) will be built in later steps.

Authorization:
  All endpoints require a valid authenticated user (get_current_user).
  Vehicle-specific access control will be added in later steps.

Never returned:
  - Model file paths
  - sklearn internals or serialized model data
  - Supabase keys or credentials
  - Training data
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import CurrentUser, get_current_user
from app.model import FEATURE_COUNT, FEATURE_NAMES, MODEL_FILENAME, MODEL_TYPE
from app.services.prediction import predict_soh

router = APIRouter(prefix="/api/ml", tags=["ML Prediction"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class PredictRequest(BaseModel):
    """
    Request body for POST /api/ml/test-predict.

    features: dict mapping each of the 52 required feature names to a
              numeric (int or float) value. All 52 are required.
              No extra keys, no NaN, no infinite values.

    Example (abbreviated):
        {
          "duration_minutes": 87.3,
          "start_soc": 0.21,
          "end_soc": 0.95,
          ...
        }
    """

    features: Dict[str, Any]


class PredictResponse(BaseModel):
    """Response body for POST /api/ml/test-predict."""

    predicted_soh: float
    model: str
    feature_count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/test-predict", response_model=PredictResponse)
async def test_predict(
    body: PredictRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> PredictResponse:
    """
    Test endpoint: validate ML model integration.

    Accepts a JSON object with exactly the 52 required model features
    and returns the model SOH prediction.

    Requires:
      Authorization: Bearer <supabase_access_token>

    Returns:
      - predicted_soh   : raw model output (float, may exceed 100)
      - model           : model filename identifier (no path)
      - feature_count   : number of features used (52)

    Validation errors (HTTP 422) are raised for:
      - missing features
      - unexpected feature names
      - forbidden keys (estimated_SOH, vehicle_id, etc.)
      - non-numeric values
      - NaN or infinite values
    """
    predicted_soh = predict_soh(body.features)

    return PredictResponse(
        predicted_soh=predicted_soh,
        model=MODEL_FILENAME,
        feature_count=FEATURE_COUNT,
    )


# ---------------------------------------------------------------------------
# Internal metadata - not exposed via API, available for health/admin use
# ---------------------------------------------------------------------------

ROUTER_MODEL_TYPE = MODEL_TYPE          # "GradientBoostingRegressor"
ROUTER_FEATURE_NAMES = FEATURE_NAMES    # canonical 52-feature list
