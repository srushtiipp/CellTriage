"""
model.py
CellTriage ML model loader.

Loads the trained GradientBoostingRegressor (best_soh_model.joblib) exactly
once at application startup and exposes it as a module-level singleton.

Design decisions:
  - The model file is located relative to this file's directory
    (app/../models/best_soh_model.joblib), so the project is fully portable
    across machines - no hardcoded Windows paths.
  - Loading happens at import time so the cost is paid once; every prediction
    request reuses the same in-memory object.
  - If the file is missing, a clear RuntimeError is raised immediately rather
    than surfacing a confusing AttributeError at prediction time.
  - No model retraining, refitting, or modification occurs here.

Exposed symbols:
  MODEL          - the loaded sklearn GradientBoostingRegressor
  MODEL_FILENAME - basename of the model file (for metadata responses)
  MODEL_TYPE     - human-readable class name
  FEATURE_NAMES  - canonical ordered list of the 52 model features
  FEATURE_COUNT  - 52
"""

from __future__ import annotations

import pathlib
from typing import List

import joblib
from sklearn.ensemble import GradientBoostingRegressor

# ---------------------------------------------------------------------------
# Resolve model path relative to this file (app/model.py)
# backend/
#   app/
#     model.py   <- __file__
#   models/
#     best_soh_model.joblib
# ---------------------------------------------------------------------------

_THIS_DIR = pathlib.Path(__file__).resolve().parent          # .../backend/app
_MODELS_DIR = _THIS_DIR.parent / "models"                   # .../backend/models
_MODEL_FILE = _MODELS_DIR / "best_soh_model.joblib"

MODEL_FILENAME: str = _MODEL_FILE.name          # "best_soh_model.joblib"

# ---------------------------------------------------------------------------
# Load the model - runs once at import time
# ---------------------------------------------------------------------------

if not _MODEL_FILE.exists():
    raise RuntimeError(
        f"Model file not found: {_MODEL_FILE}\n"
        "Expected layout: backend/models/best_soh_model.joblib\n"
        "Ensure the model file is present before starting the application."
    )

MODEL: GradientBoostingRegressor = joblib.load(_MODEL_FILE)

if not isinstance(MODEL, GradientBoostingRegressor):
    raise RuntimeError(
        f"Unexpected model type: {type(MODEL).__name__}. "
        "Expected GradientBoostingRegressor."
    )

MODEL_TYPE: str = type(MODEL).__name__   # "GradientBoostingRegressor"

# ---------------------------------------------------------------------------
# Canonical feature list - sourced directly from the fitted model object.
# Using model.feature_names_in_ (set by sklearn when fit() receives a
# DataFrame with named columns) guarantees that the ordering used here is
# always consistent with what the model was trained on.
# ---------------------------------------------------------------------------

if not hasattr(MODEL, "feature_names_in_"):
    raise RuntimeError(
        "Loaded model has no feature_names_in_ attribute. "
        "The model must have been fitted with a named DataFrame so that "
        "the canonical feature order is preserved inside the model file."
    )

FEATURE_NAMES: List[str] = list(MODEL.feature_names_in_)
FEATURE_COUNT: int = len(FEATURE_NAMES)

# Sanity-check: must be exactly 52
if FEATURE_COUNT != 52:
    raise RuntimeError(
        f"Model has {FEATURE_COUNT} features; expected exactly 52. "
        "The wrong model file may have been loaded."
    )
