import os
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger("switch_api")

class ArubaSwitchClient:
    def __init__(self, config: Dict[str, Any]):
        self.config = config.get("switch", {})
        self.switch_info = config.get("switch_info", {})
        self.ip = self.config.get("ip", "192.168.100.100")
        self.protocol = self.config.get("protocol", "http")
        self.port = self.config.get("port", 80)
        self.username = self.config.get("username", "manager")
        self.password = self.config.get("password", "")
        self.rest_version = self.config.get("rest_version", "v4")
        
        # Check demo mode in config or environment variable DEMO_MODE
        raw_demo = self.config.get("demo_mode", False)
        if isinstance(raw_demo, str):
            raw_demo = raw_demo.lower() in ("true", "1", "yes")
        env_demo = os.getenv("DEMO_MODE", "false").lower() in ("true", "1", "yes")
        self.demo_mode = bool(raw_demo) or env_demo
        
        self.base_url = f"{self.protocol}://{self.ip}:{self.port}/rest/{self.rest_version}"
        self.is_online = False
        self.last_error = ""
        # Machine-readable error for the UI, which translates it (code + params)
        self.last_error_code = ""
        self.last_error_params: Dict[str, Any] = {}
        self.session_cookie = None

        if self.demo_mode:
            self._init_demo_state()

    def _set_error(self, message: str, code: str = "", params: Optional[Dict[str, Any]] = None):
        self.last_error = message
        self.last_error_code = code
        self.last_error_params = params or {}

    def _init_demo_state(self):
        """Initialize a realistic simulated switch state for demo/dev mode."""
        preset_active = {
            1: {"link": "UP", "speed": 1000, "poe_enabled": True, "poe_delivering": True, "watts": 12.4, "vlan": 10, "name": "AP-Wi-Fi-Salon"},
            2: {"link": "UP", "speed": 1000, "poe_enabled": True, "poe_delivering": True, "watts": 6.8, "vlan": 10, "name": "AP-Wi-Fi-Etage"},
            5: {"link": "UP", "speed": 100,  "poe_enabled": True, "poe_delivering": True, "watts": 4.2, "vlan": 20, "name": "Cam-Entree"},
            6: {"link": "UP", "speed": 100,  "poe_enabled": True, "poe_delivering": True, "watts": 4.5, "vlan": 20, "name": "Cam-Jardin"},
            9: {"link": "UP", "speed": 1000, "poe_enabled": False, "poe_delivering": False, "watts": 0.0, "vlan": 1, "name": "Synology-NAS-Eth1"},
            10: {"link": "UP", "speed": 1000, "poe_enabled": False, "poe_delivering": False, "watts": 0.0, "vlan": 1, "name": "PC-Bureau"},
            12: {"link": "UP", "speed": 100, "poe_enabled": True, "poe_delivering": True, "watts": 3.1, "vlan": 30, "name": "Tel-VoIP"},
            15: {"link": "UP", "speed": 1000, "poe_enabled": True, "poe_delivering": True, "watts": 8.7, "vlan": 10, "name": "AP-Wi-Fi-Garage"},
            24: {"link": "UP", "speed": 1000, "poe_enabled": False, "poe_delivering": False, "watts": 0.0, "vlan": 1, "name": "Imprimante-Bureau"},
            49: {"link": "UP", "speed": 10000, "poe_enabled": False, "poe_delivering": False, "watts": 0.0, "vlan": 1, "name": "SFP-Uplink-10G"}
        }

        demo_ports = {}
        for i in range(1, 53):
            is_sfp = i > 48
            preset = preset_active.get(i, {})
            is_up = preset.get("link") == "UP"
            poe_enabled = preset.get("poe_enabled", not is_sfp)
            poe_delivering = preset.get("poe_delivering", False)
            
            demo_ports[i] = {
                "port_id": i,
                "is_sfp": is_sfp,
                "link_status": preset.get("link", "DOWN"),
                "is_enabled": True,
                "speed_mbps": preset.get("speed", 1000 if is_up else 0),
                "duplex": "FULL" if is_up else "AUTO",
                "poe_enabled": poe_enabled,
                "poe_active": poe_enabled or poe_delivering,
                "poe_delivering": poe_delivering,
                "poe_watts": preset.get("watts", 0.0),
                "vlan_untagged": preset.get("vlan", 1),
                "switch_port_name": preset.get("name", "")
            }
        self.demo_ports = demo_ports

    def _get_client(self) -> httpx.AsyncClient:
        headers = {}
        if self.session_cookie:
            headers["Cookie"] = self.session_cookie
        auth = (self.username, self.password)
        return httpx.AsyncClient(auth=auth, headers=headers, timeout=2.0, follow_redirects=True)

    async def login_session(self) -> bool:
        """Authenticate and create REST API session cookie if needed."""
        if self.demo_mode:
            return True
        url = f"{self.base_url}/login-sessions"
        payload = {"userName": self.username, "password": self.password}
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, json=payload, auth=(self.username, self.password))
                if res.status_code in (200, 201):
                    data = res.json()
                    self.session_cookie = data.get("cookie") or res.headers.get("set-cookie")
                    return True
        except Exception as e:
            logger.warning(f"REST login-sessions warning: {e}")
        return False

    async def get_switch_data(self) -> Dict[str, Any]:
        """Fetch real port states, PoE status, and system status concurrently via REST API (or return simulated data in demo mode)."""
        if self.demo_mode:
            self.is_online = True
            self._set_error("")
            active_ports = sum(1 for p in self.demo_ports.values() if p["link_status"] == "UP" and p.get("is_enabled", True))
            total_poe = sum(p["poe_watts"] for p in self.demo_ports.values() if p.get("poe_delivering") and p.get("is_enabled", True))
            return {
                "online": True,
                "demo_mode": True,
                "ip": self.ip,
                "model": self.switch_info.get("model", "HP 2530-48G-PoEP (Simulateur)"),
                "firmware": "YA.16.09.0007 [DEMO]",
                "serial": "DEMO-SWITCH-MODE",
                "uptime": "Mode Démo / Simulation (Sécurisé)",
                "uptime_code": "demo",
                "active_ports_count": active_ports,
                "total_poe_used_watts": round(total_poe, 1),
                "max_poe_watts": self.switch_info.get("max_poe_watts", 382.0),
                "ports": self.demo_ports
            }

        try:
            async with self._get_client() as client:
                sys_task = client.get(f"{self.base_url}/system/status")
                ports_task = client.get(f"{self.base_url}/ports")
                poe_task = client.get(f"{self.base_url}/poe/ports")
                stats_task = client.get(f"{self.base_url}/poe/ports/stats")

                results = await asyncio.gather(sys_task, ports_task, poe_task, stats_task, return_exceptions=True)
                sys_res, ports_res, poe_res, stats_res = results

                if isinstance(sys_res, Exception) or sys_res.status_code != 200:
                    self.is_online = False
                    err_msg = str(sys_res) if isinstance(sys_res, Exception) else f"HTTP {sys_res.status_code}"
                    self._set_error(f"Connexion échouée ({self.ip}): {err_msg}", "connection_failed", {"ip": self.ip, "detail": err_msg})
                    return self._generate_fallback_data()

                self.is_online = True
                self._set_error("")
                sys_data = sys_res.json()

                ports_data = {}
                if not isinstance(ports_res, Exception) and ports_res.status_code == 200:
                    ports_data = ports_res.json()

                poe_data = {}
                if not isinstance(poe_res, Exception) and poe_res.status_code == 200:
                    poe_data = poe_res.json()

                stats_data = {}
                if not isinstance(stats_res, Exception) and stats_res.status_code == 200:
                    stats_data = stats_res.json()

                return self._parse_switch_response(sys_data, ports_data, poe_data, stats_data)
        except Exception as e:
            self.is_online = False
            self._set_error(str(e), "unexpected", {"detail": str(e)})
            return self._generate_fallback_data()

    def _parse_switch_response(self, system_data: Dict, ports_data: Dict, poe_data: Dict, stats_data: Dict) -> Dict[str, Any]:
        ports_list = {}
        active_ports = 0

        raw_ports = ports_data.get("port_element", ports_data.get("collection", []))
        raw_poe = {str(p.get("port_id", p.get("id"))): p for p in poe_data.get("port_poe", poe_data.get("poe_port_element", []))}
        raw_stats = {str(p.get("port_id", p.get("id"))): p for p in stats_data.get("port_poe_stats", [])}

        for i in range(1, 53):
            port_id = str(i)
            p_info = next((p for p in raw_ports if str(p.get("id")) == port_id), {})
            poe_info = raw_poe.get(port_id, {})
            stats_info = raw_stats.get(port_id, {})

            is_up = p_info.get("is_port_up", False) or p_info.get("is_link_up", False) or (p_info.get("link_status") == "LS_UP")
            is_enabled = p_info.get("is_port_enabled", True)
            speed = p_info.get("speed_mbps", 1000 if is_up else 0)
            switch_port_name = p_info.get("name", "").strip()

            poe_enabled = poe_info.get("is_poe_enabled", False)
            actual_watts = float(stats_info.get("actual_power_in_watts", 0.0))
            detection_status = stats_info.get("poe_detection_status", "")
            is_delivering = detection_status == "PPDS_DELIVERING" or actual_watts > 0

            poe_active = poe_enabled or is_delivering

            if is_up:
                active_ports += 1

            ports_list[i] = {
                "port_id": i,
                "is_sfp": i > 48,
                "link_status": "UP" if is_up else "DOWN",
                "is_enabled": is_enabled,
                "speed_mbps": speed if is_up else 0,
                "duplex": p_info.get("duplex", "FULL" if is_up else "AUTO"),
                "poe_enabled": poe_enabled,
                "poe_active": poe_active,
                "poe_delivering": is_delivering,
                "poe_watts": round(actual_watts, 1),
                "vlan_untagged": p_info.get("untagged_vlan", 1),
                "switch_port_name": switch_port_name
            }

        total_poe_watts = float(system_data.get("total_poe_consumption", 0.0))

        return {
            "online": True,
            "ip": self.ip,
            "model": system_data.get("product_model", "HP 2530-48G-PoEP Switch (J9772A)"),
            "firmware": system_data.get("firmware_version", "YA.16.09.0007"),
            "serial": system_data.get("serial_number", "CN42FP30DT"),
            "uptime": "Connecté (REST API Live)",
            "uptime_code": "connected",
            "active_ports_count": active_ports,
            "total_poe_used_watts": round(total_poe_watts, 1),
            "max_poe_watts": self.switch_info.get("max_poe_watts", 382.0),
            "ports": ports_list
        }

    def _generate_fallback_data(self) -> Dict[str, Any]:
        ports_list = {}
        for i in range(1, 53):
            ports_list[i] = {
                "port_id": i,
                "is_sfp": i > 48,
                "link_status": "DOWN",
                "is_enabled": True,
                "speed_mbps": 0,
                "duplex": "AUTO",
                "poe_enabled": False,
                "poe_active": False,
                "poe_delivering": False,
                "poe_watts": 0.0,
                "vlan_untagged": 1
            }

        return {
            "online": False,
            "last_error": self.last_error or "Connexion au switch...",
            "last_error_code": self.last_error_code or "connecting",
            "last_error_params": self.last_error_params,
            "ip": self.ip,
            "model": self.switch_info.get("model", "HP 2530-48G-PoEP (J9772A)"),
            "firmware": "YA.16.09.0007",
            "uptime": "Hors-ligne",
            "uptime_code": "offline",
            "active_ports_count": 0,
            "total_poe_used_watts": 0.0,
            "max_poe_watts": self.switch_info.get("max_poe_watts", 382.0),
            "ports": ports_list
        }

    async def _read_until_prompt(self, reader) -> str:
        buffer = ""
        while True:
            try:
                chunk = (await asyncio.wait_for(reader.read(1024), timeout=1.0)).decode("utf-8", errors="ignore")
                buffer += chunk
                if ">" in buffer or "#" in buffer or "Username:" in buffer or "Password:" in buffer:
                    break
            except asyncio.TimeoutError:
                break
        return buffer

    async def _exec_cli_commands(self, commands: List[str]) -> bool:
        """Fallback Engine: Execute real hardware CLI configuration commands directly on HP 2530 CLI."""
        try:
            reader, writer = await asyncio.open_connection(self.ip, 23)
            
            async def send_cmd(cmd: str) -> str:
                writer.write(f"{cmd}\r\n".encode("utf-8"))
                await writer.drain()
                return await self._read_until_prompt(reader)

            out = await self._read_until_prompt(reader)
            
            # Try to login with 'manager' username for CLI as it's the standard for HP ProVision
            if "Username:" in out:
                out = await send_cmd("manager")
                # If manager fails, it will ask for password or reject
                if "Password:" not in out and "Username:" in out:
                    # Fallback to configured username if manager is not accepted
                    out = await send_cmd(self.username)
                    
            if "Password:" in out:
                out = await send_cmd(self.password)
                
            if ">" in out and "#" not in out:
                # We are operator. Try enable.
                out = await send_cmd("enable")
                if "Username:" in out:
                    out = await send_cmd("manager")
                if "Password:" in out:
                    out = await send_cmd(self.password)

            if "#" not in out:
                logger.error(f"Failed to get manager privileges on CLI. Output: {out}")
                writer.close()
                await writer.wait_closed()
                return False

            # We have manager prompt '#', enter configure mode
            out = await send_cmd("configure")

            for cmd in commands:
                logger.info(f"Executing CLI command on switch {self.ip}: {cmd}")
                out = await send_cmd(cmd)

            # Save configuration
            await send_cmd("write memory")
            await send_cmd("exit")
            await send_cmd("exit")

            writer.close()
            await writer.wait_closed()
            return True
        except Exception as e:
            logger.error(f"CLI execution error on switch {self.ip}: {e}")
            return False

    async def update_port_config(self, port_id: int, is_enabled: Optional[bool] = None, name: Optional[str] = None) -> bool:
        """Update switch port name or enabled status via REST API or CLI fallback."""
        if self.demo_mode:
            p = self.demo_ports.get(port_id)
            if p:
                if is_enabled is not None:
                    p["is_enabled"] = is_enabled
                    if not is_enabled:
                        p["link_status"] = "DOWN"
                        p["speed_mbps"] = 0
                        p["poe_delivering"] = False
                        p["poe_watts"] = 0.0
                    else:
                        p["link_status"] = "UP" if port_id in (1, 2, 5, 6, 9, 10, 12, 15, 24, 49) else "DOWN"
                        p["speed_mbps"] = 1000 if p["link_status"] == "UP" else 0
                        if p["poe_enabled"] and p["link_status"] == "UP" and not p["is_sfp"]:
                            p["poe_delivering"] = True
                            p["poe_watts"] = round(4.0 + (port_id % 6), 1)
                if name is not None:
                    p["switch_port_name"] = name
            return True

        url = f"{self.base_url}/ports/{port_id}"
        payload = {}
        if is_enabled is not None:
            payload["is_port_enabled"] = is_enabled
        if name is not None:
            payload["name"] = name

        rest_success = False
        try:
            async with self._get_client() as client:
                res = await client.put(url, json=payload)
                if res.status_code in (200, 204):
                    rest_success = True
        except Exception as e:
            logger.warning(f"REST update_port_config failed for port {port_id}: {e}")

        if not rest_success:
            # Fallback to direct hardware CLI commands
            cli_cmds = []
            if is_enabled is True:
                cli_cmds.append(f"interface {port_id} enable")
            elif is_enabled is False:
                cli_cmds.append(f"interface {port_id} disable")
            if name is not None:
                cli_cmds.append(f"interface {port_id} name \"{name}\"")
            if cli_cmds:
                return await self._exec_cli_commands(cli_cmds)

        return rest_success

    async def update_poe_config(self, port_id: int, poe_enabled: bool) -> bool:
        """Enable or disable PoE power on specified port via REST API or CLI fallback."""
        if self.demo_mode:
            p = self.demo_ports.get(port_id)
            if p:
                p["poe_enabled"] = poe_enabled
                p["poe_active"] = poe_enabled
                if not poe_enabled:
                    p["poe_delivering"] = False
                    p["poe_watts"] = 0.0
                else:
                    if p["link_status"] == "UP" and p.get("is_enabled", True) and not p["is_sfp"]:
                        p["poe_delivering"] = True
                        p["poe_watts"] = round(5.2 + (port_id % 5), 1)
            return True

        payload = {"is_poe_enabled": poe_enabled}
        rest_success = False

        try:
            async with self._get_client() as client:
                res = await client.put(f"{self.base_url}/poe/ports/{port_id}", json=payload)
                if res.status_code in (200, 204):
                    rest_success = True
                else:
                    res2 = await client.put(f"{self.base_url}/ports/{port_id}/poe", json=payload)
                    if res2.status_code in (200, 204):
                        rest_success = True
        except Exception as e:
            logger.warning(f"REST update_poe_config failed for port {port_id}: {e}")

        if not rest_success:
            # Fallback to direct hardware CLI commands
            if poe_enabled:
                cli_cmds = [f"interface {port_id} power-over-ethernet"]
            else:
                cli_cmds = [f"no interface {port_id} power-over-ethernet"]
            return await self._exec_cli_commands(cli_cmds)

        return rest_success

    async def reboot_poe_port(self, port_id: int) -> bool:
        """Power cycle PoE on specified port via REST API or CLI fallback."""
        if self.demo_mode:
            p = self.demo_ports.get(port_id)
            if p and p["poe_enabled"]:
                p["poe_delivering"] = True
                p["poe_watts"] = round(6.0 + (port_id % 4), 1)
            return True

        url = f"{self.base_url}/poe/ports/{port_id}/action"
        payload = {"action": "POEA_BOUNCE"}

        try:
            async with self._get_client() as client:
                res = await client.post(url, json=payload)
                if res.status_code in (200, 204):
                    return True
        except Exception:
            pass

        # Fallback CLI power cycle
        cli_cmds = [
            f"no interface {port_id} power-over-ethernet",
            f"interface {port_id} power-over-ethernet"
        ]
        return await self._exec_cli_commands(cli_cmds)
