"""
services/fleet_ai_tools.py
Data retrieval tools for the AI Fleet Intelligence Agent.
"""

from typing import Dict, Any, List

def get_fleet_summary(pg) -> Dict[str, Any]:
    from app.routers.fleet import _get_fleet_health_state
    fleet_health = _get_fleet_health_state(pg)
    
    total_vehicles = len(fleet_health)
    healthy_count = sum(1 for r in fleet_health if r.get("soh", 0) >= 90)
    medium_risk_count = sum(1 for r in fleet_health if 80 <= r.get("soh", 0) < 90)
    high_risk_count = sum(1 for r in fleet_health if 70 <= r.get("soh", 0) < 80)
    critical_count = sum(1 for r in fleet_health if r.get("soh", 0) < 70)
    
    total_soh = sum(r.get("soh", 0) for r in fleet_health if r.get("soh") is not None)
    average_soh = total_soh / total_vehicles if total_vehicles > 0 else 0
    
    sorted_by_soh = sorted([r for r in fleet_health if r.get("soh") is not None], key=lambda x: x["soh"])
    lowest_soh = sorted_by_soh[0] if sorted_by_soh else None
    highest_soh = sorted_by_soh[-1] if sorted_by_soh else None
    
    return {
        "total_vehicles": total_vehicles,
        "average_soh": average_soh,
        "risk_distribution": {
            "healthy": healthy_count,
            "medium_risk": medium_risk_count,
            "high_risk": high_risk_count,
            "critical": critical_count
        },
        "weakest_vehicle": lowest_soh,
        "healthiest_vehicle": highest_soh
    }

def get_fleet_soh_overview(pg) -> List[Dict[str, Any]]:
    from app.routers.fleet import _get_fleet_health_state
    fleet_health = _get_fleet_health_state(pg)
    records = []
    for record in fleet_health:
        records.append({
            "vehicle_id": record["vehicle_id"],
            "latest_soh": record.get("soh"),
            "latest_efc": record.get("efc"),
            "risk_level": record.get("risk_level")
        })
    records.sort(key=lambda x: (x["latest_soh"] is None, x["latest_soh"]))
    return records

def get_vehicle_comparison(pg, vehicle_ids: List[str]) -> List[Dict[str, Any]]:
    vehicles_resp = pg.table("vehicles").select("vehicle_id, model").in_("vehicle_id", vehicle_ids).execute()
    found_vehicles = {v["vehicle_id"]: v for v in (vehicles_resp.data or [])}
    
    results = []
    for vid in vehicle_ids:
        if vid not in found_vehicles:
            continue
            
        h_resp = pg.table("battery_health").select("soh, efc, risk_level, degradation_rate").eq("vehicle_id", vid).order("efc", desc=True).limit(1).execute()
        h_data = h_resp.data[0] if h_resp.data else {}
        
        m_resp = pg.table("battery_metrics").select("soc, temperature, voltage_spread, temperature_spread, odometer").eq("vehicle_id", vid).order("odometer", desc=True).limit(1).execute()
        m_data = m_resp.data[0] if m_resp.data else {}
        
        results.append({
            "vehicle_id": vid,
            "model": found_vehicles[vid].get("model"),
            "latest_soh": h_data.get("soh"),
            "latest_efc": h_data.get("efc"),
            "risk_level": h_data.get("risk_level"),
            "degradation_rate": h_data.get("degradation_rate"),
            "latest_soc": m_data.get("soc"),
            "latest_temperature": m_data.get("temperature"),
            "latest_voltage_spread": m_data.get("voltage_spread"),
            "latest_temperature_spread": m_data.get("temperature_spread"),
            "odometer": m_data.get("odometer")
        })
    return results

def get_vehicle_health_history(pg, vehicle_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    from app.services.ai_tools import get_health_history
    return get_health_history(pg, vehicle_id, limit)

def get_vehicle_summary(pg, vehicle_id: str) -> Dict[str, Any]:
    from app.services.ai_tools import get_vehicle_summary
    return get_vehicle_summary(pg, vehicle_id)
