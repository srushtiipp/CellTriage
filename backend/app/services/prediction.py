"""
services/prediction.py
CellTriage SOH prediction service.

Provides:
  predict_soh(features: dict) -> float

Validation rules enforced before every prediction:
  - All 52 required feature names must be present (no missing features).
  - No extra/unexpected feature names are accepted (strict allowlist).
  - estimated_SOH and other non-feature metadata columns are explicitly
    rejected if supplied.
  - Every value must be a finite real number (int or float).
  - NaN and infinite values are rejected.
  - The feature vector is assembled in the exact canonical order stored in
    the fitted model (model.feature_names_in_), so order in the input dict
    does not matter - the service imposes the correct order.

The model object is imported from app.model (loaded once at startup).
This module itself performs no model loading.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List

import pandas as pd
from fastapi import HTTPException

from app.model import FEATURE_COUNT, FEATURE_NAMES, MODEL

# ---------------------------------------------------------------------------
# Columns that are explicitly NOT model features.
# Supplying any of these is a client error (HTTP 422).
# ---------------------------------------------------------------------------
_FORBIDDEN_KEYS = frozenset(
    {
        "vehicle_id",
        "session_id",
        "start_timestamp",
        "end_timestamp",
        "telemetry_points",
        "estimated_SOH",   # dataset target - never an input feature
    }
)


# ---------------------------------------------------------------------------
# Public prediction function
# ---------------------------------------------------------------------------


def predict_soh(features: Dict[str, Any]) -> float:
    """
    Validate the feature dictionary and return the model SOH prediction.

    Args:
        features: A dict mapping feature name -> numeric value.
                  Must contain exactly the 52 model features.

    Returns:
        predicted_soh (float) - the raw model output.
        Raw output is returned unchanged; clipping/normalization is NOT applied.

    Raises:
        HTTPException(422) for any validation failure.
    """
    _validate(features)

    # Build a single-row DataFrame with the canonical column order.
    # Passing a named DataFrame ensures sklearn does not emit a UserWarning
    # about missing feature names and validates column alignment internally.
    row = pd.DataFrame(
        [[features[name] for name in FEATURE_NAMES]],
        columns=FEATURE_NAMES,
    )

    prediction = MODEL.predict(row)   # shape: (1,)
    predicted_soh: float = float(prediction[0])
    return predicted_soh


# ---------------------------------------------------------------------------
# Internal validation logic
# ---------------------------------------------------------------------------


def _validate(features: Dict[str, Any]) -> None:
    """Raise HTTPException(422) on any validation failure."""

    if not isinstance(features, dict):
        raise HTTPException(
            status_code=422,
            detail="Feature input must be a JSON object (dict).",
        )

    supplied_keys = set(features.keys())
    required_keys = set(FEATURE_NAMES)

    # 1. Reject explicitly forbidden keys
    forbidden_present = supplied_keys & _FORBIDDEN_KEYS
    if forbidden_present:
        raise HTTPException(
            status_code=422,
            detail=(
                "Forbidden key(s) supplied - these are not model features: "
                f"{sorted(forbidden_present)}. "
                "Remove them from the request."
            ),
        )

    # 2. Reject unexpected keys (strict allowlist)
    unexpected = supplied_keys - required_keys - _FORBIDDEN_KEYS
    if unexpected:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unexpected feature name(s): {sorted(unexpected)}. "
                f"Only the {FEATURE_COUNT} model features are accepted."
            ),
        )

    # 3. Reject missing features
    missing = required_keys - supplied_keys
    if missing:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Missing required feature(s): {sorted(missing)}. "
                f"All {FEATURE_COUNT} features are required."
            ),
        )

    # 4. Validate individual values
    bad_type: List[str] = []
    bad_finite: List[str] = []

    for name in FEATURE_NAMES:
        val = features[name]

        # Must be numeric (int or float, not bool, not str)
        if isinstance(val, bool) or not isinstance(val, (int, float)):
            bad_type.append(name)
            continue

        # Must be finite (reject NaN and +/-inf)
        if not math.isfinite(val):
            bad_finite.append(name)

    if bad_type:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Non-numeric value(s) for feature(s): {bad_type}. "
                "All feature values must be int or float."
            ),
        )

    if bad_finite:
        raise HTTPException(
            status_code=422,
            detail=(
                f"NaN or infinite value(s) for feature(s): {bad_finite}. "
                "All feature values must be finite real numbers."
            ),
        )