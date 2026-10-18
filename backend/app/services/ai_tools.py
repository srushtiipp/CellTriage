"""
services/ai_tools.py
Grounded database tools for the AI Copilot.
"""

from typing import Dict, Any, List

def get_vehicle_summary(pg, vehicle_id: str) -> Dict[str, Any]:
    h_resp = pg.table("battery_health").select("soh, efc, risk_level, degradation_rate").eq("vehicle_id", vehicle_id).order("efc", desc=True).limit(1).execute()
    m_resp = pg.table("battery_metrics").select("soc, pack_voltage, current, temperature, voltage_spread, temperature_spread, odometer").eq("vehicle_id", vehicle_id).order("odometer", desc=True).limit(1).execute()
    
    h_data = h_resp.data[0] if h_resp.data else {}
    m_data = m_resp.data[0] if m_resp.data else {}
    
    return {
        "vehicle_id": vehicle_id,
        "latest_soh": h_data.get("soh"),
        "latest_efc": h_data.get("efc"),
        "risk_level": h_data.get("risk_level"),
        "degradation_rate": h_data.get("degradation_rate"),
        "latest_soc": m_data.get("soc"),
        "latest_pack_voltage": m_data.get("pack_voltage"),
        "latest_current": m_data.get("current"),
        "latest_temperature": m_data.get("temperature"),
        "latest_voltage_spread": m_data.get("voltage_spread"),
        "latest_temperature_spread": m_data.get("temperature_spread"),
        "latest_odometer": m_data.get("odometer"),
    }

def get_health_history(pg, vehicle_id: str, limit: int = 15) -> List[Dict[str, Any]]:
    """Returns sensible recent history window."""
    resp = pg.table("battery_health").select("soh, efc, risk_level, degradation_rate").eq("vehicle_id", vehicle_id).order("efc", desc=True).limit(limit).execute()
    return resp.data or []

def get_battery_metrics(pg, vehicle_id: str, limit: int = 15) -> List[Dict[str, Any]]:
    """Returns sensible recent metrics window."""
    resp = pg.table("battery_metrics").select("soc, pack_voltage, current, temperature, voltage_spread, temperature_spread, odometer").eq("vehicle_id", vehicle_id).order("odometer", desc=True).limit(limit).execute()
    return resp.data or []

def get_health_trend(pg, vehicle_id: str) -> Dict[str, Any]:
    """Calculates useful trend information from actual data."""
    history = get_health_history(pg, vehicle_id, limit=30)
    if len(history) < 2:
        return {"trend": "insufficient_data"}
        
    latest_soh = history[0].get("soh", 0)
    oldest_soh = history[-1].get("soh", 0)
    soh_change = latest_soh - oldest_soh
    
    latest_efc = history[0].get("efc", 0)
    oldest_efc = history[-1].get("efc", 0)
    efc_progression = latest_efc - oldest_efc
    
    # Calculate stability/direction
    if soh_change < -1.5:
        direction = "declining rapidly"
    elif soh_change < -0.2:
        direction = "declining gradually"
    else:
        direction = "stable"
        
    return {
        "recent_soh_change": round(soh_change, 3),
        "efc_progression": round(efc_progression, 3),
        "degradation_trend": history[0].get("degradation_rate"),
        "direction": direction
    }

def get_model_prediction(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Uses the existing ML prediction infrastructure. 
    Does not load/retrain/modify the model.
    """
    from app.services.prediction import predict_soh
    try:
        val = predict_soh(features)
        return {"predicted_soh": val, "basis": "ML prediction from best_soh_model"}
    except Exception as e:
        return {"error": str(e)}
