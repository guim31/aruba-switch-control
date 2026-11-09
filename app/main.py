from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import os
import json

from app.database import (
    init_db,
    get_all_port_metadata,
    get_port_metadata,
    save_port_metadata,
    reset_all_ports_metadata
)
from app.switch_api import ArubaSwitchClient

app = FastAPI(
    title="HP 2530-48G-PoEP Visual Switch Manager",
    description="Interface de gestion visuelle et interactive du Switch HP 2530-48G-PoEP (J9772A)",
    version="1.3.0"
)

# Base Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")

# Mount Static Files
app.mount("/static", StaticFiles(directory=PUBLIC_DIR), name="static")

# Global Switch Client instance
switch_client: Optional[ArubaSwitchClient] = None

def load_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_config(cfg: Dict[str, Any]):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)

@app.on_event("startup")
def startup_event():
    global switch_client
    init_db()
    cfg = load_config()
    switch_client = ArubaSwitchClient(cfg)

# Data Models
class PortMetadataModel(BaseModel):
    custom_name: Optional[str] = ""
    cable_color: Optional[str] = "#3b82f6"
    cable_type: Optional[str] = "Cat6"
    patch_panel_port: Optional[str] = ""
    device_category: Optional[str] = "other"
    notes: Optional[str] = ""

class SwitchControlModel(BaseModel):
    action: str = Field(..., description="Action: enable, disable, poe_enable, poe_disable, poe_bounce")

class SwitchConfigModel(BaseModel):
    ip: str
    protocol: Optional[str] = "http"
    port: Optional[int] = 80
    username: Optional[str] = "administrator"
    password: Optional[str] = ""
    demo_mode: Optional[bool] = False


@app.get("/", response_class=FileResponse)
async def read_root():
    return FileResponse(os.path.join(PUBLIC_DIR, "index.html"))


@app.get("/api/status")
async def get_status():
    """Fetch real hardware state from switch REST API and merge visual metadata from local SQLite DB."""
    global switch_client
    if not switch_client:
        cfg = load_config()
        switch_client = ArubaSwitchClient(cfg)

    is_demo = getattr(switch_client, "demo_mode", False)
    live_data = await switch_client.get_switch_data()
    db_metadata = get_all_port_metadata(is_demo=is_demo)

    merged_ports = []
    total_active_poe_watts = 0.0

    for p_id in range(1, 53):
        meta = db_metadata.get(p_id, {})
        hw_port = live_data.get("ports", {}).get(p_id, {})

        hw_desc = hw_port.get("switch_port_name", "")
        custom_name = meta.get("custom_name") or hw_desc or f"Port {p_id}"

        # 100% Real Hardware Truth directly from switch REST API
        poe_enabled = hw_port.get("poe_enabled", False)
        poe_active = hw_port.get("poe_active", False)
        poe_delivering = hw_port.get("poe_delivering", False)
        poe_watts = hw_port.get("poe_watts", 0.0)

        if poe_delivering:
            total_active_poe_watts += poe_watts

        merged_ports.append({
            "port_id": p_id,
            "is_sfp": p_id > 48,
            "custom_name": custom_name,
            "cable_color": meta.get("cable_color", "#64748b"),
            "cable_type": meta.get("cable_type", "Cat6"),
            "patch_panel_port": meta.get("patch_panel_port", ""),
            "device_category": meta.get("device_category", "other"),
            "notes": meta.get("notes", ""),
            "link_status": hw_port.get("link_status", "DOWN"),
            "is_enabled": hw_port.get("is_enabled", True),
            "speed_mbps": hw_port.get("speed_mbps", 0),
            "duplex": hw_port.get("duplex", "AUTO"),
            "poe_enabled": poe_enabled,
            "poe_active": poe_active,
            "poe_delivering": poe_delivering,
            "poe_watts": poe_watts,
            "vlan_untagged": hw_port.get("vlan_untagged", 1)
        })

    return {
        "online": live_data.get("online", False),
        "demo_mode": getattr(switch_client, "demo_mode", False),
        "last_error": switch_client.last_error,
        "ip": live_data.get("ip", "192.168.100.100"),
        "model": live_data.get("model", "HP 2530-48G-PoEP (J9772A)"),
        "firmware": live_data.get("firmware", "YA.16.09.0007"),
        "serial": live_data.get("serial", "CN42FP30DT"),
        "uptime": live_data.get("uptime", "Connecté"),
        "active_ports_count": live_data.get("active_ports_count", 0),
        "total_poe_used_watts": round(total_active_poe_watts if total_active_poe_watts > 0 else live_data.get("total_poe_used_watts", 0.0), 1),
        "max_poe_watts": live_data.get("max_poe_watts", 382.0),
        "ports": merged_ports
    }

@app.post("/api/ports/{port_id}/metadata")
async def update_port_meta(port_id: int, meta: PortMetadataModel):
    if port_id < 1 or port_id > 52:
        raise HTTPException(status_code=400, detail="Invalid port number")
    
    is_demo = getattr(switch_client, "demo_mode", False)
    updated = save_port_metadata(port_id, meta.dict(), is_demo=is_demo)
    
    if meta.custom_name and switch_client and switch_client.is_online and not is_demo:
        await switch_client.update_port_config(port_id, name=meta.custom_name)
        
    return updated

@app.post("/api/ports/reset-all")
async def reset_all_ports():
    """Clears all metadata for all ports 1..52."""
    is_demo = getattr(switch_client, "demo_mode", False)
    success = reset_all_ports_metadata(is_demo=is_demo)
    return {"message": "Tous les ports ont été réinitialisés avec succès.", "success": success}

@app.post("/api/ports/{port_id}/control")
async def control_port(port_id: int, ctrl: SwitchControlModel):
    if port_id < 1 or port_id > 52:
        raise HTTPException(status_code=400, detail="Invalid port number")
    
    if not switch_client:
        raise HTTPException(status_code=500, detail="Switch client not initialized")

    success = False
    if ctrl.action == "enable":
        success = await switch_client.update_port_config(port_id, is_enabled=True)
    elif ctrl.action == "disable":
        success = await switch_client.update_port_config(port_id, is_enabled=False)
    elif ctrl.action == "poe_enable":
        success = await switch_client.update_poe_config(port_id, poe_enabled=True)
    elif ctrl.action == "poe_disable":
        success = await switch_client.update_poe_config(port_id, poe_enabled=False)
    elif ctrl.action == "poe_bounce":
        success = await switch_client.reboot_poe_port(port_id)
    else:
        raise HTTPException(status_code=400, detail="Unknown action")

    return {"success": success, "port_id": port_id, "action": ctrl.action}


@app.get("/api/config")
async def get_config():
    cfg = load_config()
    sw = cfg.get("switch", {})
    return {
        "ip": sw.get("ip", "192.168.100.100"),
        "protocol": sw.get("protocol", "http"),
        "port": sw.get("port", 80),
        "username": sw.get("username", "administrator"),
        "demo_mode": sw.get("demo_mode", False) or (os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes"))
    }

@app.post("/api/config")
async def update_config(new_cfg: SwitchConfigModel):
    global switch_client
    cfg = load_config()
    if "switch" not in cfg:
        cfg["switch"] = {}
    cfg["switch"]["ip"] = new_cfg.ip
    cfg["switch"]["protocol"] = new_cfg.protocol
    cfg["switch"]["port"] = new_cfg.port
    cfg["switch"]["username"] = new_cfg.username
    cfg["switch"]["password"] = new_cfg.password or ""
    cfg["switch"]["demo_mode"] = bool(new_cfg.demo_mode)

    save_config(cfg)
    switch_client = ArubaSwitchClient(cfg)
    
    # Check connection
    data = await switch_client.get_switch_data()
    return {"message": "Configuration enregistrée", "online": data.get("online", False), "demo_mode": switch_client.demo_mode}
