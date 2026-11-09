import sqlite3
import os
from typing import Dict, Any, List, Optional
from datetime import datetime

PROD_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "switch_metadata.db")
DEMO_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "demo_switch_metadata.db")

def get_db(is_demo: bool = False):
    path = DEMO_DB_PATH if is_demo else PROD_DB_PATH
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize both production and demo database tables if not present."""
    for is_demo in (False, True):
        with get_db(is_demo=is_demo) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS port_metadata (
                    port_id INTEGER PRIMARY KEY,
                    custom_name TEXT DEFAULT '',
                    cable_color TEXT DEFAULT '#64748b',
                    cable_type TEXT DEFAULT 'Cat6',
                    patch_panel_port TEXT DEFAULT '',
                    device_category TEXT DEFAULT 'other',
                    notes TEXT DEFAULT '',
                    updated_at TEXT
                )
            """)
            conn.commit()

            cursor.execute("SELECT COUNT(*) FROM port_metadata")
            count = cursor.fetchone()[0]
            if count == 0:
                seed_default_ports(cursor, is_demo=is_demo)
                conn.commit()

def seed_default_ports(cursor, is_demo: bool = False):
    now = datetime.utcnow().isoformat()
    if is_demo:
        sample_colors = {
            # Patch panel jacks go to the top row (odd ports) in order, so the demo cables stay tidy
            1: ("Serveur Principal", "#ef4444", "Cat6a", "PP-01", "server", "Serveur VMware ESXi"),
            3: ("Passerelle Routeur", "#f97316", "Cat6a", "PP-02", "router", "Routeur Firewall PfSense"),
            5: ("Borne Wi-Fi Etage 1", "#eab308", "Cat6", "PP-03", "ap", "Aruba AP-305 PoE+"),
            7: ("Borne Wi-Fi RDC", "#eab308", "Cat6", "PP-04", "ap", "Aruba AP-305 PoE+"),
            9: ("Caméra Parking", "#22c55e", "Cat6", "PP-05", "camera", "Caméra Hikvision PoE"),
            11: ("Caméra Entrée", "#22c55e", "Cat6", "PP-06", "camera", "Caméra Hikvision PoE"),
            13: ("NAS Synology LACP 1", "#3b82f6", "Cat6a", "PP-07", "server", "Synology DS1821+ Port 1"),
            15: ("NAS Synology LACP 2", "#3b82f6", "Cat6a", "PP-08", "server", "Synology DS1821+ Port 2"),
            49: ("Uplink SFP 1G Fibre", "#a855f7", "Fiber MM", "OPT-01", "switch", "Lien Switch Coeur (SFP 1)"),
        }
    else:
        sample_colors = {}
    
    for port_id in range(1, 53):
        if port_id in sample_colors:
            name, color, c_type, pp, cat, note = sample_colors[port_id]
        else:
            name, color, c_type, pp, cat, note = (f"Port {port_id}" if port_id <= 48 else f"Port SFP {port_id}", "#64748b", "Cat6", "", "other", "")
            
        cursor.execute("""
            INSERT INTO port_metadata (port_id, custom_name, cable_color, cable_type, patch_panel_port, device_category, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (port_id, name, color, c_type, pp, cat, note, now))

def get_all_port_metadata(is_demo: bool = False) -> Dict[int, Dict[str, Any]]:
    with get_db(is_demo=is_demo) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM port_metadata")
        rows = cursor.fetchall()
        return {
            row["port_id"]: {
                "port_id": row["port_id"],
                "custom_name": row["custom_name"],
                "cable_color": row["cable_color"],
                "cable_type": row["cable_type"],
                "patch_panel_port": row["patch_panel_port"],
                "device_category": row["device_category"],
                "notes": row["notes"],
                "updated_at": row["updated_at"]
            }
            for row in rows
        }

def get_port_metadata(port_id: int, is_demo: bool = False) -> Optional[Dict[str, Any]]:
    with get_db(is_demo=is_demo) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM port_metadata WHERE port_id = ?", (port_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "port_id": row["port_id"],
            "custom_name": row["custom_name"],
            "cable_color": row["cable_color"],
            "cable_type": row["cable_type"],
            "patch_panel_port": row["patch_panel_port"],
            "device_category": row["device_category"],
            "notes": row["notes"],
            "updated_at": row["updated_at"]
        }

def save_port_metadata(port_id: int, data: Dict[str, Any], is_demo: bool = False) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat()
    with get_db(is_demo=is_demo) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO port_metadata (port_id, custom_name, cable_color, cable_type, patch_panel_port, device_category, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(port_id) DO UPDATE SET
                custom_name = excluded.custom_name,
                cable_color = excluded.cable_color,
                cable_type = excluded.cable_type,
                patch_panel_port = excluded.patch_panel_port,
                device_category = excluded.device_category,
                notes = excluded.notes,
                updated_at = excluded.updated_at
        """, (
            port_id,
            data.get("custom_name", ""),
            data.get("cable_color", "#3b82f6"),
            data.get("cable_type", "Cat6"),
            data.get("patch_panel_port", ""),
            data.get("device_category", "other"),
            data.get("notes", ""),
            now
        ))
        conn.commit()
    return get_port_metadata(port_id, is_demo=is_demo)

def reset_all_ports_metadata(is_demo: bool = False) -> bool:
    """Reset all 52 ports metadata back to factory empty defaults."""
    now = datetime.utcnow().isoformat()
    with get_db(is_demo=is_demo) as conn:
        cursor = conn.cursor()
        for port_id in range(1, 53):
            default_name = f"Port {port_id}" if port_id <= 48 else f"Port SFP {port_id}"
            cursor.execute("""
                UPDATE port_metadata
                SET custom_name = ?,
                    cable_color = '#64748b',
                    cable_type = 'Cat6',
                    patch_panel_port = '',
                    device_category = 'other',
                    notes = '',
                    updated_at = ?
                WHERE port_id = ?
            """, (default_name, now, port_id))
        conn.commit()
    return True
