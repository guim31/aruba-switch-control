/**
 * Aruba HP 2530-48G-PoEP Visual Switch Manager - Frontend JavaScript
 * Includes Persistent Search & Filters and 100% Real Switch Hardware Synchronization
 */

let appState = {
    ports: [],
    online: false,
    selectedPortId: 1,
    searchQuery: localStorage.getItem("filter_search") || '',
    statusFilter: localStorage.getItem("filter_status") || 'all',
    colorFilter: localStorage.getItem("filter_color") || 'all',
    showPatchPanel: true,
    showCables: true,
    pollingInterval: null,
    theme: 'dark',
    
    // Interactive Cable Wiring & Drag State
    wiringSource: null,
    isDragging: false,
    hasDragged: false,
    dragStartPos: { x: 0, y: 0 },
    dragStartScreenPos: { x: 0, y: 0 },
    
    // Target Port for Quick Cable Color Picker
    quickColorPortId: null,

    // Multi-Select (CTRL + Click) State
    selectedPorts: new Set(),
    isMultiSelectClick: false
};

// Cable color palette labels
const COLOR_NAMES = {
    "#ef4444": "Rouge",
    "#f97316": "Orange",
    "#eab308": "Jaune",
    "#22c55e": "Vert",
    "#3b82f6": "Bleu",
    "#a855f7": "Violet",
    "#ec4899": "Rose",
    "#64748b": "Gris",
    "#ffffff": "Blanc",
    "#000000": "Noir"
};

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initApp();
});

function initTheme() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    appState.theme = savedTheme;
    applyTheme(savedTheme);

    const toggleBtn = document.getElementById("btn-theme-toggle");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const nextTheme = appState.theme === "dark" ? "light" : "dark";
            appState.theme = nextTheme;
            localStorage.setItem("theme", nextTheme);
            applyTheme(nextTheme);
            setTimeout(drawPatchCables, 100);
        });
    }
}

function applyTheme(theme) {
    const htmlEl = document.documentElement;
    const iconEl = document.getElementById("theme-toggle-icon");
    const textEl = document.getElementById("theme-toggle-text");

    if (theme === "dark") {
        htmlEl.classList.add("dark");
        if (iconEl) iconEl.className = "fa-solid fa-sun text-amber-400";
        if (textEl) textEl.textContent = "Mode Clair";
    } else {
        htmlEl.classList.remove("dark");
        if (iconEl) iconEl.className = "fa-solid fa-moon text-slate-600";
        if (textEl) textEl.textContent = "Mode Sombre";
    }
}

async function initApp() {
    restorePersistentFilters();
    setupEventListeners();
    setupGlobalWiringListeners();
    await fetchStatus();
    
    // Auto polling every 5 seconds
    appState.pollingInterval = setInterval(fetchStatus, 5000);
    window.addEventListener("resize", () => setTimeout(drawPatchCables, 100));
}

function restorePersistentFilters() {
    const inputSearch = document.getElementById("input-search");
    const filterStatus = document.getElementById("filter-status");

    if (inputSearch && appState.searchQuery) {
        inputSearch.value = appState.searchQuery;
    }
    if (filterStatus && appState.statusFilter) {
        filterStatus.value = appState.statusFilter;
    }
}

function setupEventListeners() {
    // Refresh button
    document.getElementById("btn-refresh").addEventListener("click", () => fetchStatus());

    // Toggle Visual Cables
    document.getElementById("btn-toggle-cables").addEventListener("click", () => {
        appState.showCables = !appState.showCables;
        const txt = document.getElementById("cables-toggle-text");
        const btn = document.getElementById("btn-toggle-cables");

        if (appState.showCables) {
            txt.textContent = "Masquer Câbles";
            btn.className = "flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shadow-md cursor-pointer";
            drawPatchCables();
        } else {
            txt.textContent = "Afficher les Câbles";
            btn.className = "flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition shadow-md shadow-cyan-600/20 cursor-pointer";
            drawPatchCables();
        }
    });

    // Toggle Patch Panel
    document.getElementById("btn-toggle-patchpanel").addEventListener("click", () => {
        appState.showPatchPanel = !appState.showPatchPanel;
        const panel = document.getElementById("patch-panel-container");
        const txt = document.getElementById("patchpanel-toggle-text");

        if (appState.showPatchPanel) {
            panel.classList.remove("hidden");
            txt.textContent = "Masquer Baie";
        } else {
            panel.classList.add("hidden");
            txt.textContent = "Afficher Baie";
        }
        setTimeout(drawPatchCables, 100);
    });

    // Search and filter inputs with localStorage persistence
    document.getElementById("input-search").addEventListener("input", (e) => {
        appState.searchQuery = e.target.value.toLowerCase();
        localStorage.setItem("filter_search", appState.searchQuery);
        renderPortsGrid();
        setTimeout(drawPatchCables, 100);
    });

    document.getElementById("filter-status").addEventListener("change", (e) => {
        appState.statusFilter = e.target.value;
        localStorage.setItem("filter_status", appState.statusFilter);
        renderPortsGrid();
        setTimeout(drawPatchCables, 100);
    });

    document.getElementById("filter-color").addEventListener("change", (e) => {
        appState.colorFilter = e.target.value;
        localStorage.setItem("filter_color", appState.colorFilter);
        renderPortsGrid();
        setTimeout(drawPatchCables, 100);
    });

    document.getElementById("btn-reset-filters").addEventListener("click", () => {
        appState.searchQuery = '';
        appState.statusFilter = 'all';
        appState.colorFilter = 'all';

        localStorage.removeItem("filter_search");
        localStorage.removeItem("filter_status");
        localStorage.removeItem("filter_color");

        document.getElementById("input-search").value = '';
        document.getElementById("filter-status").value = 'all';
        document.getElementById("filter-color").value = 'all';
        renderPortsGrid();
        setTimeout(drawPatchCables, 100);
    });

    document.getElementById("btn-reset-all-ports").addEventListener("click", handleResetAllPorts);

    // Modal Edit Port
    document.getElementById("btn-close-modal").addEventListener("click", closeModal);
    document.getElementById("btn-cancel-edit").addEventListener("click", closeModal);
    document.getElementById("btn-edit-selected-port").addEventListener("click", () => openEditModal(appState.selectedPortId));
    document.getElementById("form-edit-port").addEventListener("submit", handleSavePortMetadata);
    document.getElementById("btn-free-port").addEventListener("click", handleFreePort);

    // Quick Cable Color Modal Listeners
    document.getElementById("btn-close-quick-color").addEventListener("click", closeQuickCableColorModal);
    
    document.querySelectorAll(".quick-swatch-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const hex = btn.getAttribute("data-color");
            applyQuickCableColor(hex);
        });
    });

    document.getElementById("quick-color-custom-picker").addEventListener("input", (e) => {
        applyQuickCableColor(e.target.value);
    });

    // Color Swatches in Edit Modal
    document.querySelectorAll(".swatch-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".swatch-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            const hex = btn.getAttribute("data-color");
            document.getElementById("edit-color-picker").value = hex;
        });
    });

    document.getElementById("edit-color-picker").addEventListener("input", () => {
        document.querySelectorAll(".swatch-btn").forEach(b => b.classList.remove("selected"));
    });

    // Hardware Actions in Modal
    document.getElementById("btn-toggle-port").addEventListener("click", handleTogglePortState);
    document.getElementById("btn-toggle-poe").addEventListener("click", handleTogglePoeClick);
    document.getElementById("btn-bounce-poe").addEventListener("click", handleBouncePoe);

    // PoE Safety Danger Modal Listeners
    document.getElementById("chk-confirm-poe").addEventListener("change", (e) => {
        const confirmBtn = document.getElementById("btn-execute-poe-enable");
        if (e.target.checked) {
            confirmBtn.disabled = false;
            confirmBtn.className = "px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 cursor-pointer flex items-center gap-2";
        } else {
            confirmBtn.disabled = true;
            confirmBtn.className = "px-5 py-2 rounded-lg bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 text-xs font-bold transition cursor-not-allowed flex items-center gap-2";
        }
    });

    document.getElementById("btn-cancel-poe-warning").addEventListener("click", closePoeWarningModal);
    document.getElementById("btn-execute-poe-enable").addEventListener("click", executePoeEnable);

    // Settings Modal
    document.getElementById("btn-settings").addEventListener("click", openSettingsModal);
    document.getElementById("btn-close-settings").addEventListener("click", closeSettingsModal);
    document.getElementById("btn-cancel-settings").addEventListener("click", closeSettingsModal);
    document.getElementById("form-settings").addEventListener("submit", handleSaveSettings);

    // Bulk Actions Floating Bar Listeners
    document.getElementById("btn-bulk-poe-enable").addEventListener("click", () => executeBulkAction('poe_enable'));
    document.getElementById("btn-bulk-poe-disable").addEventListener("click", () => executeBulkAction('poe_disable'));
    document.getElementById("btn-bulk-poe-bounce").addEventListener("click", () => executeBulkAction('poe_bounce'));
    document.getElementById("btn-bulk-port-enable").addEventListener("click", () => executeBulkAction('enable'));
    document.getElementById("btn-bulk-port-disable").addEventListener("click", () => executeBulkAction('disable'));
    document.getElementById("btn-bulk-free-port").addEventListener("click", () => executeBulkAction('free'));
    document.getElementById("btn-bulk-clear-selection").addEventListener("click", clearMultiSelection);
}

// Bulk Action Helpers (CTRL + Click)
function updateBulkActionBar() {
    const bar = document.getElementById("bulk-actions-bar");
    const countEl = document.getElementById("bulk-selection-count");
    if (!bar || !countEl) return;

    const count = appState.selectedPorts.size;
    countEl.textContent = count;

    if (count > 0) {
        bar.classList.remove("hidden");
    } else {
        bar.classList.add("hidden");
    }
}

function clearMultiSelection() {
    appState.selectedPorts.clear();
    renderPortsGrid();
    updateBulkActionBar();
}

async function executeBulkAction(action) {
    const ports = Array.from(appState.selectedPorts).sort((a, b) => a - b);
    if (ports.length === 0) return;

    const actionLabels = {
        'poe_enable': 'Activation PoE',
        'poe_disable': 'Désactivation PoE',
        'poe_bounce': 'Reboot PoE',
        'enable': 'Activation Port',
        'disable': 'Désactivation Port',
        'free': 'Libération Port'
    };

    const actionTitle = actionLabels[action] || 'Traitement';

    // UI Progress State
    const buttonsContainer = document.getElementById("bulk-buttons-container");
    const progressContainer = document.getElementById("bulk-progress-container");
    const progressText = document.getElementById("bulk-progress-text");
    const progressPct = document.getElementById("bulk-progress-pct");
    const progressBar = document.getElementById("bulk-progress-bar");

    if (buttonsContainer) buttonsContainer.classList.add("hidden");
    if (progressContainer) progressContainer.classList.remove("hidden");

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ports.length; i++) {
        const portId = ports[i];
        const pct = Math.round(((i + 1) / ports.length) * 100);

        if (progressText) progressText.textContent = `${actionTitle} sur Port ${portId} (${i + 1}/${ports.length})...`;
        if (progressPct) progressPct.textContent = `${pct}%`;
        if (progressBar) progressBar.style.width = `${pct}%`;

        try {
            if (action === 'free') {
                const payload = {
                    custom_name: `Port ${portId}`,
                    cable_color: "#64748b",
                    cable_type: "Cat6",
                    patch_panel_port: "",
                    device_category: "other",
                    notes: ""
                };
                const res = await fetch(`/api/ports/${portId}/metadata`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (res.ok) successCount++; else failCount++;
            } else {
                const res = await fetch(`/api/ports/${portId}/control`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: action })
                });
                if (res.ok) successCount++; else failCount++;
            }
        } catch (err) {
            console.error(`Bulk action error on port ${portId}:`, err);
            failCount++;
        }
    }

    // Reset UI Progress State
    if (buttonsContainer) buttonsContainer.classList.remove("hidden");
    if (progressContainer) progressContainer.classList.add("hidden");
    if (progressBar) progressBar.style.width = "0%";

    clearMultiSelection();
    await fetchStatus();

    showToastNotification(`⚡ Action de groupe effectuée sur ${ports.length} port(s) (${successCount} réussi(s)${failCount > 0 ? `, ${failCount} échec(s)` : ''}) !`);
}

// Global Drag-and-Drop Rubberband & Click Listeners
function setupGlobalWiringListeners() {
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("touchmove", (e) => handleGlobalMouseMove(e.touches[0]));
    window.addEventListener("touchend", (e) => handleGlobalMouseUp(e.changedTouches[0]));
}

function startCableDrag(e, type, id, element, color, linkedPortId) {
    if (e.button && e.button !== 0) return;

    // Check for CTRL (or CMD on macOS) Multi-Select mode
    if (e.ctrlKey || e.metaKey) {
        const targetPortId = type === 'switch' ? parseInt(id, 10) : linkedPortId;
        if (targetPortId) {
            if (appState.selectedPorts.has(targetPortId)) {
                appState.selectedPorts.delete(targetPortId);
            } else {
                appState.selectedPorts.add(targetPortId);
            }
            renderPortsGrid();
            updateBulkActionBar();
        }
        appState.isMultiSelectClick = true;
        return;
    }

    const rackSection = document.getElementById("rack-section");
    if (!rackSection) return;
    const rackRect = rackSection.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();

    const startX = elRect.left + elRect.width / 2 - rackRect.left;
    const startY = elRect.top + elRect.height / 2 - rackRect.top;

    appState.isDragging = true;
    appState.hasDragged = false;
    appState.dragStartPos = { x: startX, y: startY };
    appState.dragStartScreenPos = { x: e.clientX, y: e.clientY };
    appState.wiringSource = { type, id, element, color, linkedPortId };

    element.classList.add("wiring-source");
}

function handleGlobalMouseMove(e) {
    if (!appState.isDragging || !appState.wiringSource || appState.isMultiSelectClick) return;

    const dx = Math.abs(e.clientX - appState.dragStartScreenPos.x);
    const dy = Math.abs(e.clientY - appState.dragStartScreenPos.y);

    if (dx > 4 || dy > 4) {
        if (!appState.hasDragged) {
            appState.hasDragged = true;
            document.body.classList.add("wiring-mode");
        }

        const rackSection = document.getElementById("rack-section");
        if (!rackSection) return;
        const rackRect = rackSection.getBoundingClientRect();

        const mouseX = e.clientX - rackRect.left;
        const mouseY = e.clientY - rackRect.top;

        drawDragRubberbandCable(appState.dragStartPos.x, appState.dragStartPos.y, mouseX, mouseY, appState.wiringSource.color);

        const elUnder = document.elementFromPoint(e.clientX, e.clientY);
        const targetPortEl = elUnder ? elUnder.closest(".port-unit, .patch-port-unit") : null;

        document.querySelectorAll(".port-unit, .patch-port-unit").forEach(p => p.classList.remove("drop-target-active"));

        if (targetPortEl && targetPortEl !== appState.wiringSource.element) {
            targetPortEl.classList.add("drop-target-active");
        }
    }
}

async function handleGlobalMouseUp(e) {
    if (appState.isMultiSelectClick) {
        appState.isMultiSelectClick = false;
        appState.isDragging = false;
        appState.wiringSource = null;
        return;
    }

    if (!appState.isDragging || !appState.wiringSource) return;

    const source = appState.wiringSource;
    const hasDragged = appState.hasDragged;

    appState.isDragging = false;
    appState.hasDragged = false;
    appState.wiringSource = null;
    document.body.classList.remove("wiring-mode");
    removeDragRubberbandCable();

    document.querySelectorAll(".port-unit, .patch-port-unit").forEach(p => {
        p.classList.remove("wiring-source");
        p.classList.remove("drop-target-active");
    });

    if (!hasDragged) {
        // If clicking without CTRL, clear multi-selection
        if (appState.selectedPorts.size > 0) {
            appState.selectedPorts.clear();
            updateBulkActionBar();
        }

        if (source.type === 'switch') {
            appState.selectedPortId = parseInt(source.id, 10);
            renderPortsGrid();
            updateDetailPanel(appState.selectedPortId);
            openEditModal(appState.selectedPortId);
        } else if (source.type === 'patch' && source.linkedPortId) {
            appState.selectedPortId = source.linkedPortId;
            renderPortsGrid();
            updateDetailPanel(appState.selectedPortId);
            openEditModal(appState.selectedPortId);
        }
    } else {
        const elUnder = document.elementFromPoint(e.clientX, e.clientY);
        const targetPortEl = elUnder ? elUnder.closest(".port-unit, .patch-port-unit") : null;

        if (targetPortEl && targetPortEl !== source.element) {
            await completeCableConnection(source, targetPortEl);
        }
    }
}

function drawDragRubberbandCable(x1, y1, x2, y2, color) {
    const svgLayer = document.getElementById("cables-svg-layer");
    if (!svgLayer) return;

    svgLayer.classList.remove("hidden");
    let tempPath = document.getElementById("temp-drag-cable");

    if (!tempPath) {
        tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        tempPath.setAttribute("id", "temp-drag-cable");
        tempPath.setAttribute("stroke-width", "6.5");
        tempPath.setAttribute("stroke-dasharray", "6 4");
        tempPath.setAttribute("class", "patch-cable-path highlighted");
        svgLayer.appendChild(tempPath);
    }

    const deltaY = Math.max(35, Math.abs(y2 - y1) * 0.45);
    const pathData = `M ${x1},${y1} C ${x1},${y1 + deltaY} ${x2},${y2 - deltaY} ${x2},${y2}`;

    tempPath.setAttribute("d", pathData);
    tempPath.setAttribute("stroke", color || "#3b82f6");
}

function removeDragRubberbandCable() {
    const tempPath = document.getElementById("temp-drag-cable");
    if (tempPath) tempPath.remove();
}

async function completeCableConnection(source, targetElement) {
    let patchId = null;
    let switchPortId = null;

    if (source.type === 'patch') {
        patchId = source.id;
        switchPortId = parseInt(targetElement.dataset.portId, 10);
    } else if (source.type === 'switch') {
        switchPortId = parseInt(source.id, 10);
        patchId = targetElement.dataset.patchId;
    } else {
        if (targetElement.classList.contains("port-unit") && source.element.classList.contains("patch-port-unit")) {
            patchId = source.id;
            switchPortId = parseInt(targetElement.dataset.portId, 10);
        } else if (targetElement.classList.contains("patch-port-unit") && source.element.classList.contains("port-unit")) {
            switchPortId = parseInt(source.id, 10);
            patchId = targetElement.dataset.patchId;
        }
    }

    if (patchId && switchPortId) {
        const switchPort = appState.ports.find(p => p.port_id === switchPortId);
        const patchStr = `PP-${patchId.toString().padStart(2, '0')}`;
        const cableColor = (switchPort && switchPort.cable_color !== "#64748b") ? switchPort.cable_color : "#3b82f6";

        const payload = {
            custom_name: switchPort ? switchPort.custom_name : `Port ${switchPortId}`,
            cable_color: cableColor,
            cable_type: switchPort ? switchPort.cable_type : "Cat6",
            patch_panel_port: patchStr,
            device_category: switchPort ? switchPort.device_category : "other",
            notes: switchPort ? switchPort.notes : ""
        };

        try {
            const res = await fetch(`/api/ports/${switchPortId}/metadata`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                appState.showCables = true;
                const txt = document.getElementById("cables-toggle-text");
                if (txt) txt.textContent = "Masquer Câbles";

                await fetchStatus();
                showToastNotification(`🔌 Jarretière raccordée : Prise Baie PP-${patchId} ↔️ Port Switch ${switchPortId} !`);
            }
        } catch (err) {
            console.error("Wiring connection error:", err);
        }
    }
}

// Quick Cable Color Picker Modal
function openQuickCableColorModal(portId) {
    const port = appState.ports.find(p => p.port_id === portId);
    if (!port) return;

    appState.quickColorPortId = portId;
    document.getElementById("quick-color-port-num").textContent = portId;
    document.getElementById("quick-color-patch-info").textContent = port.patch_panel_port ? `(Raccordé ${port.patch_panel_port})` : '';

    const currentColor = (port.cable_color || "#3b82f6").toLowerCase();
    document.getElementById("quick-color-custom-picker").value = currentColor;

    document.querySelectorAll(".quick-swatch-btn").forEach(btn => {
        const hex = btn.getAttribute("data-color").toLowerCase();
        if (hex === currentColor) {
            btn.classList.add("selected");
        } else {
            btn.classList.remove("selected");
        }
    });

    document.getElementById("modal-cable-color").classList.remove("hidden");
}

function closeQuickCableColorModal() {
    document.getElementById("modal-cable-color").classList.add("hidden");
    appState.quickColorPortId = null;
}

async function applyQuickCableColor(hexColor) {
    const portId = appState.quickColorPortId;
    if (!portId) return;

    const port = appState.ports.find(p => p.port_id === portId);
    if (!port) return;

    const payload = {
        custom_name: port.custom_name,
        cable_color: hexColor,
        cable_type: port.cable_type,
        patch_panel_port: port.patch_panel_port,
        device_category: port.device_category,
        notes: port.notes
    };

    try {
        const res = await fetch(`/api/ports/${portId}/metadata`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeQuickCableColorModal();
            await fetchStatus();
            showToastNotification(`🎨 Couleur du câble mise à jour (${COLOR_NAMES[hexColor.toLowerCase()] || hexColor}) !`);
        }
    } catch (err) {
        console.error("Error applying quick cable color:", err);
    }
}

function showToastNotification(message) {
    let toast = document.getElementById("app-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "app-toast";
        toast.className = "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-2xl border border-cyan-500/40 flex items-center gap-2 transition-all duration-300 transform translate-y-10 opacity-0";
        document.body.appendChild(toast);
    }

    toast.innerHTML = `<i class="fa-solid fa-circle-check text-cyan-400 text-sm"></i> ${message}`;
    toast.classList.remove("translate-y-10", "opacity-0");

    setTimeout(() => {
        toast.classList.add("translate-y-10", "opacity-0");
    }, 3500);
}

async function fetchStatus() {
    try {
        const res = await fetch("/api/status");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        
        appState.online = data.online;
        appState.ports = data.ports || [];
        
        updateStatusHeader(data);
        updateKpiMetrics(data);
        populateColorFilterOptions();
        renderPortsGrid();
        renderPatchPanelGrid();
        
        if (appState.selectedPortId) {
            updateDetailPanel(appState.selectedPortId);
        }
        
        setTimeout(drawPatchCables, 100);
    } catch (err) {
        console.error("Error fetching switch status:", err);
        appState.online = false;
        const offlineData = {
            online: false,
            uptime: "Hors-ligne / Inaccessible",
            active_ports_count: 0,
            total_poe_used_watts: 0,
            max_poe_watts: 382.0
        };
        updateStatusPill(false, "Switch Hors-ligne / Inaccessible");
        updateKpiMetrics(offlineData);
    }
}

function updateStatusHeader(data) {
    document.getElementById("switch-ip-display").textContent = data.ip || "192.168.100.100";
    document.getElementById("firmware-display").textContent = data.firmware || "YA.16.09.0007";
    document.getElementById("model-badge").textContent = data.demo_mode ? "SIMULATEUR" : "J9772A";

    const demoBadge = document.getElementById("demo-badge");
    if (demoBadge) {
        if (data.demo_mode) {
            demoBadge.classList.remove("hidden");
            demoBadge.classList.add("flex");
        } else {
            demoBadge.classList.add("hidden");
            demoBadge.classList.remove("flex");
        }
    }

    updateStatusPill(data.online, data.demo_mode ? "Mode Démo (Simulé)" : (data.online ? "REST API Active" : (data.last_error || "Switch Hors-Ligne")));
}

function updateStatusPill(online, text) {
    const pill = document.getElementById("status-pill");
    const dot = document.getElementById("status-dot");
    const ping = document.getElementById("status-ping");
    const statusText = document.getElementById("status-text");

    statusText.textContent = text;
    if (online) {
        pill.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30";
        dot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500";
        ping.className = "animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75";
    } else {
        pill.className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30";
        dot.className = "relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500";
        ping.className = "hidden";
    }
}

function updateKpiMetrics(data) {
    const active = data.active_ports_count || 0;
    const total = 52;
    const pctPorts = Math.round((active / total) * 100);
    
    document.getElementById("stat-active-ports").textContent = `${active} / ${total}`;
    document.getElementById("stat-ports-pct").textContent = `${pctPorts}% connecté`;
    document.getElementById("bar-active-ports").style.width = `${pctPorts}%`;

    const poeWatts = data.total_poe_used_watts || 0.0;
    const maxWatts = data.max_poe_watts || 382.0;
    const pctPoe = Math.min(100, Math.round((poeWatts / maxWatts) * 100));

    document.getElementById("stat-poe-watts").textContent = `${poeWatts.toFixed(1)} W`;
    document.getElementById("stat-poe-max").textContent = `${maxWatts} W`;
    document.getElementById("bar-poe-watts").style.width = `${pctPoe}%`;

    const isOnline = data.online !== false;
    const uptimeEl = document.getElementById("stat-uptime");
    const uptimeDot = document.getElementById("stat-uptime-dot");

    if (isOnline) {
        uptimeEl.textContent = data.uptime || "Connecté (REST API Live)";
        uptimeEl.className = "text-sm font-bold text-slate-900 dark:text-white leading-snug";
        if (uptimeDot) uptimeDot.className = "inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0";
    } else {
        uptimeEl.textContent = data.last_error || "Hors-ligne / Inaccessible";
        uptimeEl.className = "text-sm font-bold text-amber-600 dark:text-amber-400 leading-snug";
        if (uptimeDot) uptimeDot.className = "inline-block w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 shrink-0";
    }

    updateCableColorPills();
}

function updateCableColorPills() {
    const container = document.getElementById("cable-color-pills");
    if (!container) return;
    const colorCounts = {};

    appState.ports.forEach(p => {
        const col = p.cable_color || "#64748b";
        colorCounts[col] = (colorCounts[col] || 0) + 1;
    });

    container.innerHTML = Object.entries(colorCounts).map(([hex, count]) => {
        const label = COLOR_NAMES[hex.toLowerCase()] || hex;
        return `
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                <span class="w-2 h-2 rounded-full" style="background-color: ${hex}"></span>
                <span>${label}: <strong>${count}</strong></span>
            </span>
        `;
    }).join('');
}

function populateColorFilterOptions() {
    const select = document.getElementById("filter-color");
    const currentVal = appState.colorFilter || select.value;
    const colors = new Set(appState.ports.map(p => p.cable_color).filter(Boolean));

    select.innerHTML = '<option value="all">Toutes les couleurs de câble</option>';
    colors.forEach(hex => {
        const name = COLOR_NAMES[hex.toLowerCase()] || hex;
        const opt = document.createElement("option");
        opt.value = hex;
        opt.textContent = `${name} (${hex})`;
        if (hex === currentVal) opt.selected = true;
        select.appendChild(opt);
    });
}

function renderPortsGrid() {
    const mainGrid = document.getElementById("ports-grid");
    const sfpGrid = document.getElementById("sfp-grid");

    mainGrid.innerHTML = "";
    sfpGrid.innerHTML = "";

    const rj45Ports = appState.ports.filter(p => p.port_id <= 48);
    const sfpPorts = appState.ports.filter(p => p.port_id > 48);

    const blocks = [
        { title: "PORTS 1 - 12", start: 1, end: 12 },
        { title: "PORTS 13 - 24", start: 13, end: 24 },
        { title: "PORTS 25 - 36", start: 25, end: 36 },
        { title: "PORTS 37 - 48", start: 37, end: 48 }
    ];

    blocks.forEach(b => {
        const blockWrapper = document.createElement("div");
        blockWrapper.className = "flex flex-col items-center bg-zinc-900/90 border border-zinc-700/80 rounded-lg p-1.5 shadow-inner shrink-0";

        const titleEl = document.createElement("div");
        titleEl.className = "text-[8.5px] font-mono font-bold text-slate-400 mb-1 tracking-wider uppercase";
        titleEl.textContent = b.title;
        blockWrapper.appendChild(titleEl);

        const blockGrid = document.createElement("div");
        blockGrid.className = "grid grid-cols-6 gap-1 sm:gap-1.5";

        const blockPorts = rj45Ports.filter(p => p.port_id >= b.start && p.port_id <= b.end);
        const oddPorts = blockPorts.filter(p => p.port_id % 2 !== 0);
        const evenPorts = blockPorts.filter(p => p.port_id % 2 === 0);

        oddPorts.forEach(p => blockGrid.appendChild(createPortElement(p)));
        evenPorts.forEach(p => blockGrid.appendChild(createPortElement(p)));

        blockWrapper.appendChild(blockGrid);
        mainGrid.appendChild(blockWrapper);
    });

    sfpPorts.forEach(port => {
        sfpGrid.appendChild(createSfpElement(port));
    });

    const visibleCount = getFilteredPorts().length;
    document.getElementById("filtered-count").textContent = `${visibleCount} / 52 ports affichés`;
}

function renderPatchPanelGrid() {
    const gridContainer = document.getElementById("patch-panel-ports-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";

    const modules = [
        { title: "PP 1 - 8", start: 1, end: 8 },
        { title: "PP 9 - 16", start: 9, end: 16 },
        { title: "PP 17 - 24", start: 17, end: 24 }
    ];

    modules.forEach(mod => {
        const modWrapper = document.createElement("div");
        modWrapper.className = "flex flex-col items-center bg-zinc-900/90 border border-zinc-700/80 rounded-lg p-1.5 shadow-inner shrink-0";

        const titleEl = document.createElement("div");
        titleEl.className = "text-[7.5px] font-mono font-bold text-slate-400 mb-0.5 tracking-wider uppercase";
        titleEl.textContent = mod.title;
        modWrapper.appendChild(titleEl);

        const portsRow = document.createElement("div");
        portsRow.className = "flex items-center gap-1 sm:gap-1.5 justify-center";

        for (let patchId = mod.start; patchId <= mod.end; patchId++) {
            const linkedSwitchPort = appState.ports.find(p => {
                if (!p.patch_panel_port) return false;
                const str = p.patch_panel_port.toString().toLowerCase();
                return str === patchId.toString() || str.endsWith(`-${patchId}`) || str.endsWith(`-${patchId.toString().padStart(2, '0')}`);
            });

            const isPoeDelivering = linkedSwitchPort && (linkedSwitchPort.poe_delivering || (linkedSwitchPort.poe_watts && linkedSwitchPort.poe_watts > 0));

            const el = document.createElement("div");
            el.className = `patch-port-unit ${isPoeDelivering ? 'poe-delivering-halo' : ''}`;
            el.dataset.patchId = patchId;

            const color = linkedSwitchPort ? (linkedSwitchPort.cable_color || "#3b82f6") : "#334155";
            const bootRing = linkedSwitchPort ? `<div class="cable-boot-ring" style="border-color: ${color}"></div>` : '';

            el.innerHTML = `
                ${bootRing}
                <div class="patch-label-strip">${patchId}</div>
                <div class="port-socket"></div>
                <div class="text-[7.5px] font-mono text-slate-400 font-bold">${linkedSwitchPort ? `S${linkedSwitchPort.port_id}` : '--'}</div>
            `;

            el.title = linkedSwitchPort
                ? `Prise Panneau PP-${patchId} -> Raccordé au Port Switch ${linkedSwitchPort.port_id} (${linkedSwitchPort.custom_name})${isPoeDelivering ? `\n⚡ Alimentation PoE Active (${linkedSwitchPort.poe_watts} W)` : ''}\n💡 Cliquez pour éditer ou glissez pour déplacer le câble !`
                : `Prise Panneau PP-${patchId} (Libre)\n💡 Maintenez la souris enfoncée pour tirer un câble !`;

            const linkedPortId = linkedSwitchPort ? linkedSwitchPort.port_id : null;

            el.addEventListener("mousedown", (e) => startCableDrag(e, 'patch', patchId, el, color, linkedPortId));
            el.addEventListener("touchstart", (e) => startCableDrag(e.touches[0], 'patch', patchId, el, color, linkedPortId));

            if (linkedSwitchPort) {
                el.addEventListener("mouseenter", () => {
                    const switchEl = document.querySelector(`.port-unit[data-port-id="${linkedSwitchPort.port_id}"]`);
                    if (switchEl) switchEl.classList.add("linked-hover");

                    const cablePath = document.querySelector(`.patch-cable-path[data-port-id="${linkedSwitchPort.port_id}"]`);
                    if (cablePath) cablePath.classList.add("highlighted");

                    updateDetailPanel(linkedSwitchPort.port_id);
                });

                el.addEventListener("mouseleave", () => {
                    const switchEl = document.querySelector(`.port-unit[data-port-id="${linkedSwitchPort.port_id}"]`);
                    if (switchEl) switchEl.classList.remove("linked-hover");

                    const cablePath = document.querySelector(`.patch-cable-path[data-port-id="${linkedSwitchPort.port_id}"]`);
                    if (cablePath) cablePath.classList.remove("highlighted");
                });
            }

            portsRow.appendChild(el);
        }

        modWrapper.appendChild(portsRow);
        gridContainer.appendChild(modWrapper);
    });
}

function resetAllCableHoverStates(svgLayer) {
    if (!svgLayer) return;
    svgLayer.querySelectorAll(".patch-cable-glow").forEach(el => el.setAttribute("opacity", "0"));
    svgLayer.querySelectorAll(".patch-cable-path").forEach(el => el.setAttribute("stroke-width", "6.0"));
    svgLayer.querySelectorAll(".patch-cable-shadow").forEach(el => {
        el.setAttribute("stroke-width", "9.0");
        el.setAttribute("opacity", "0.22");
    });
}

function drawPatchCables() {
    const svgLayer = document.getElementById("cables-svg-layer");
    if (!svgLayer) return;

    if (!appState.showCables || !appState.showPatchPanel) {
        svgLayer.classList.add("hidden");
        return;
    }

    svgLayer.classList.remove("hidden");

    const defs = svgLayer.querySelector("defs");
    svgLayer.innerHTML = "";
    if (defs) svgLayer.appendChild(defs);

    // Global reset on layer mouseleave
    svgLayer.onmouseleave = () => resetAllCableHoverStates(svgLayer);

    const rackSection = document.getElementById("rack-section");
    if (!rackSection) return;
    const rackRect = rackSection.getBoundingClientRect();

    appState.ports.forEach(port => {
        if (!port.patch_panel_port) return;

        const pStr = port.patch_panel_port.toString().toLowerCase();
        const patchUnits = document.querySelectorAll(".patch-port-unit");
        let targetPatchEl = null;

        patchUnits.forEach(pu => {
            const patchId = pu.dataset.patchId;
            if (pStr === patchId || pStr.endsWith(`-${patchId}`) || pStr.endsWith(`-${patchId.padStart(2, '0')}`)) {
                targetPatchEl = pu;
            }
        });

        const switchPortEl = document.querySelector(`.port-unit[data-port-id="${port.port_id}"]`);

        if (targetPatchEl && switchPortEl) {
            const pRect = targetPatchEl.getBoundingClientRect();
            const sRect = switchPortEl.getBoundingClientRect();

            const x1 = pRect.left + pRect.width / 2 - rackRect.left;
            const y1 = pRect.bottom - 4 - rackRect.top;

            const x2 = sRect.left + sRect.width / 2 - rackRect.left;
            const y2 = sRect.top + 4 - rackRect.top;

            const deltaY = Math.max(35, Math.abs(y2 - y1) * 0.45);
            const pathData = `M ${x1},${y1} C ${x1},${y1 + deltaY} ${x2},${y2 - deltaY} ${x2},${y2}`;

            const cableColor = port.cable_color || "#3b82f6";
            const isPoeDelivering = port.poe_delivering || (port.poe_watts && port.poe_watts > 0);

            // 1. Native SVG Shadow Path (Clean, zero-artifact 3D depth at cable crossings)
            const shadowEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            shadowEl.setAttribute("d", pathData);
            shadowEl.setAttribute("stroke", "#000000");
            shadowEl.setAttribute("stroke-width", "9.0");
            shadowEl.setAttribute("opacity", "0.22");
            shadowEl.setAttribute("class", "patch-cable-shadow");
            shadowEl.dataset.portId = port.port_id;
            svgLayer.appendChild(shadowEl);

            // 2. Native SVG Glow Path (Vivid cyan aura on hover, 100% bug-free)
            const glowEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            glowEl.setAttribute("d", pathData);
            glowEl.setAttribute("stroke", "#06b6d4");
            glowEl.setAttribute("stroke-width", "15.0");
            glowEl.setAttribute("opacity", "0");
            glowEl.setAttribute("class", "patch-cable-glow");
            glowEl.dataset.portId = port.port_id;
            svgLayer.appendChild(glowEl);

            // 3. Main Cable Core (Solid cable color, sleek 6px line)
            const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
            pathEl.setAttribute("d", pathData);
            pathEl.setAttribute("stroke", cableColor);
            pathEl.setAttribute("stroke-width", "6.0");
            pathEl.setAttribute("opacity", "0.95");
            pathEl.setAttribute("class", "patch-cable-path");
            pathEl.dataset.portId = port.port_id;
            svgLayer.appendChild(pathEl);

            // 4. PoE Static Luminous Precision Dots Overlay (if PoE power is active)
            let poeOverlay = null;
            if (isPoeDelivering) {
                poeOverlay = document.createElementNS("http://www.w3.org/2000/svg", "path");
                poeOverlay.setAttribute("d", pathData);
                poeOverlay.setAttribute("class", "poe-energy-dot-path");
                poeOverlay.dataset.portId = port.port_id;
                svgLayer.appendChild(poeOverlay);
            }

            const handleCableHover = () => {
                resetAllCableHoverStates(svgLayer);
                glowEl.setAttribute("opacity", "0.5");
                pathEl.setAttribute("stroke-width", "8.0");
                shadowEl.setAttribute("stroke-width", "13.0");
                shadowEl.setAttribute("opacity", "0.35");
                updateDetailPanel(port.port_id);
            };

            const handleCableLeave = () => {
                resetAllCableHoverStates(svgLayer);
            };

            const handleCableClick = (e) => {
                e.stopPropagation();
                openQuickCableColorModal(port.port_id);
            };

            pathEl.addEventListener("mouseenter", handleCableHover);
            pathEl.addEventListener("mouseleave", handleCableLeave);
            pathEl.addEventListener("click", handleCableClick);

            if (poeOverlay) {
                poeOverlay.addEventListener("mouseenter", handleCableHover);
                poeOverlay.addEventListener("mouseleave", handleCableLeave);
                poeOverlay.addEventListener("click", handleCableClick);
            }
        }
    });
}

function getFilteredPorts() {
    return appState.ports.filter(p => {
        if (appState.searchQuery) {
            const query = appState.searchQuery;
            const matchName = (p.custom_name || '').toLowerCase().includes(query);
            const matchPort = p.port_id.toString() === query;
            const matchVlan = (p.vlan_untagged || '').toString() === query;
            const matchNotes = (p.notes || '').toLowerCase().includes(query);
            const matchPatch = (p.patch_panel_port || '').toLowerCase().includes(query);
            if (!matchName && !matchPort && !matchVlan && !matchNotes && !matchPatch) {
                return false;
            }
        }

        if (appState.statusFilter === 'up' && p.link_status !== 'UP') return false;
        if (appState.statusFilter === 'down' && p.link_status !== 'DOWN') return false;
        if (appState.statusFilter === 'poe' && !p.poe_active) return false;
        if (appState.statusFilter === 'disabled' && p.is_enabled) return false;

        if (appState.colorFilter !== 'all' && p.cable_color !== appState.colorFilter) return false;

        return true;
    });
}

function createPortElement(port) {
    const isVisible = getFilteredPorts().some(p => p.port_id === port.port_id);
    const isUp = port.link_status === 'UP';
    const isSelected = appState.selectedPortId === port.port_id;
    const isMultiSelected = appState.selectedPorts.has(port.port_id);
    const isPoeDelivering = port.poe_delivering || (port.poe_watts && port.poe_watts > 0);
    const color = port.cable_color || "#64748b";

    const el = document.createElement("div");
    el.className = `port-unit ${isSelected ? 'active-selected' : ''} ${isMultiSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 active-selected' : ''} ${isPoeDelivering ? 'poe-delivering-halo' : ''} ${!isVisible ? 'opacity-20 scale-95' : ''}`;
    el.dataset.portId = port.port_id;

    const bootRing = `<div class="cable-boot-ring" style="border-color: ${color}"></div>`;

    let ledClass = '';
    if (isUp) {
        ledClass = port.speed_mbps >= 1000 ? 'led-1000m' : 'led-100m';
    }

    let poeIcon = '';
    if (port.poe_delivering) {
        poeIcon = `<span class="led-indicator led-poe" title="PoE Alimenté (${port.poe_watts} W)"></span>`;
    } else if (port.poe_active) {
        poeIcon = `<span class="led-indicator led-poe opacity-60" title="PoE Activé (En recherche/Attente)"></span>`;
    }

    el.innerHTML = `
        ${bootRing}
        <div class="port-leds">
            <span class="led-indicator ${ledClass}"></span>
            ${poeIcon}
        </div>
        <div class="port-socket"></div>
        <div class="port-number">${port.port_id}</div>
    `;

    el.title = `Port Switch ${port.port_id} (${port.custom_name})\n💡 Cliquez pour configurer, CTRL+Clic pour sélection multiple, ou glissez pour relier !`;

    el.addEventListener("mousedown", (e) => startCableDrag(e, 'switch', port.port_id, el, color, port.port_id));
    el.addEventListener("touchstart", (e) => startCableDrag(e.touches[0], 'switch', port.port_id, el, color, port.port_id));

    el.addEventListener("mouseenter", () => {
        updateDetailPanel(port.port_id);
        if (port.patch_panel_port) {
            const patchUnits = document.querySelectorAll(".patch-port-unit");
            patchUnits.forEach(pu => {
                const patchId = pu.dataset.patchId;
                const pStr = port.patch_panel_port.toString().toLowerCase();
                if (pStr === patchId || pStr.endsWith(`-${patchId}`) || pStr.endsWith(`-${patchId.padStart(2, '0')}`)) {
                    pu.classList.add("linked-hover");
                }
            });
            const cablePath = document.querySelector(`.patch-cable-path[data-port-id="${port.port_id}"]`);
            if (cablePath) cablePath.classList.add("highlighted");
        }
    });

    el.addEventListener("mouseleave", () => {
        document.querySelectorAll(".patch-port-unit").forEach(pu => pu.classList.remove("linked-hover"));
        const cablePath = document.querySelector(`.patch-cable-path[data-port-id="${port.port_id}"]`);
        if (cablePath) cablePath.classList.remove("highlighted");
    });

    return el;
}

function createSfpElement(port) {
    const isVisible = getFilteredPorts().some(p => p.port_id === port.port_id);
    const isUp = port.link_status === 'UP';
    const isSelected = appState.selectedPortId === port.port_id;
    const isMultiSelected = appState.selectedPorts.has(port.port_id);

    const el = document.createElement("div");
    el.className = `sfp-unit ${isSelected ? 'active-selected' : ''} ${isMultiSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 active-selected' : ''} ${!isVisible ? 'opacity-20' : ''}`;
    el.dataset.portId = port.port_id;

    el.innerHTML = `
        <div class="flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full ${isUp ? 'bg-purple-400 shadow-sm shadow-purple-400' : 'bg-slate-700'}"></span>
            <span class="text-[9px] font-mono text-purple-300 font-bold">${port.port_id}</span>
        </div>
        <div class="text-[8px] text-slate-400 font-mono">SFP</div>
    `;

    el.addEventListener("mouseenter", () => updateDetailPanel(port.port_id));
    el.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (appState.selectedPorts.has(port.port_id)) {
                appState.selectedPorts.delete(port.port_id);
            } else {
                appState.selectedPorts.add(port.port_id);
            }
            renderPortsGrid();
            updateBulkActionBar();
            return;
        }

        if (appState.selectedPorts.size > 0) {
            appState.selectedPorts.clear();
            updateBulkActionBar();
        }

        appState.selectedPortId = port.port_id;
        renderPortsGrid();
        updateDetailPanel(port.port_id);
        openEditModal(port.port_id);
    });

    return el;
}

function updateDetailPanel(portId) {
    const port = appState.ports.find(p => p.port_id === portId);
    if (!port) return;

    const panel = document.getElementById("port-detail-panel");
    panel.classList.remove("hidden");

    document.getElementById("panel-port-num").textContent = port.port_id;
    document.getElementById("panel-port-name").textContent = port.custom_name || `Port ${port.port_id}`;

    const statusBadge = document.getElementById("panel-link-status");
    if (port.link_status === 'UP') {
        statusBadge.className = "px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800";
        statusBadge.textContent = `LINK UP (${port.speed_mbps} Mbps)`;
    } else {
        statusBadge.className = "px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700";
        statusBadge.textContent = "LINK DOWN";
    }

    document.getElementById("panel-vlan-tag").textContent = `VLAN ${port.vlan_untagged || 1}`;

    const colorHex = port.cable_color || "#64748b";
    document.getElementById("panel-cable-color-name").textContent = COLOR_NAMES[colorHex.toLowerCase()] || colorHex;
    document.getElementById("panel-color-indicator").style.backgroundColor = colorHex;
    document.getElementById("panel-cable-type").textContent = port.cable_type || "Cat6";
    document.getElementById("panel-patch-port").textContent = port.patch_panel_port || "Non renseigné";
    
    let poeText = "Désactivé";
    if (port.poe_delivering) {
        poeText = `${port.poe_watts} W (Alimenté)`;
    } else if (port.poe_active) {
        poeText = "Activé (En attente/Recherche)";
    }
    document.getElementById("panel-poe-watts").textContent = poeText;
    document.getElementById("panel-notes").textContent = port.notes ? `Note: ${port.notes}` : "Aucune note particulière.";
}

function openEditModal(portId) {
    const port = appState.ports.find(p => p.port_id === portId);
    if (!port) return;

    document.getElementById("edit-port-id").value = port.port_id;
    document.getElementById("modal-port-num").textContent = port.port_id;
    document.getElementById("modal-port-title").textContent = port.port_id;

    document.getElementById("edit-custom-name").value = port.custom_name || '';
    document.getElementById("edit-cable-type").value = port.cable_type || 'Cat6';
    document.getElementById("edit-patch-port").value = port.patch_panel_port || '';
    document.getElementById("edit-device-cat").value = port.device_category || 'other';
    document.getElementById("edit-notes").value = port.notes || '';

    const poeBtnLabel = document.getElementById("poe-btn-label");
    const poeBtn = document.getElementById("btn-toggle-poe");

    if (port.poe_active) {
        poeBtnLabel.textContent = "Désactiver PoE";
        poeBtn.className = "px-2.5 py-1.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/80 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 transition cursor-pointer flex items-center justify-center gap-1";
    } else {
        poeBtnLabel.textContent = "Activer PoE";
        poeBtn.className = "px-2.5 py-1.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 transition cursor-pointer flex items-center justify-center gap-1";
    }

    const colorHex = port.cable_color || '#3b82f6';
    document.getElementById("edit-color-picker").value = colorHex;

    document.querySelectorAll(".swatch-btn").forEach(btn => {
        if (btn.getAttribute("data-color").toLowerCase() === colorHex.toLowerCase()) {
            btn.classList.add("selected");
        } else {
            btn.classList.remove("selected");
        }
    });

    document.getElementById("modal-edit-port").classList.remove("hidden");
}

function closeModal() {
    document.getElementById("modal-edit-port").classList.add("hidden");
}

function handleTogglePoeClick() {
    const portId = parseInt(document.getElementById("edit-port-id").value, 10);
    const port = appState.ports.find(p => p.port_id === portId);
    if (!port) return;

    if (port.poe_active) {
        if (confirm(`Voulez-vous vraiment DÉSACTIVER l'alimentation PoE sur le Port ${portId} (${port.custom_name}) ?`)) {
            sendControlAction(portId, "poe_disable");
        }
    } else {
        openPoeWarningModal(portId, port.custom_name);
    }
}

function openPoeWarningModal(portId, customName) {
    document.getElementById("poe-warn-port-num").textContent = portId;
    document.getElementById("poe-warn-port-num2").textContent = portId;

    const chk = document.getElementById("chk-confirm-poe");
    chk.checked = false;

    const btnExec = document.getElementById("btn-execute-poe-enable");
    btnExec.disabled = true;
    btnExec.className = "px-5 py-2 rounded-lg bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 text-xs font-bold transition cursor-not-allowed flex items-center gap-2";

    document.getElementById("modal-poe-warning").classList.remove("hidden");
}

function closePoeWarningModal() {
    document.getElementById("modal-poe-warning").classList.add("hidden");
}

async function executePoeEnable() {
    const portId = parseInt(document.getElementById("edit-port-id").value, 10);
    closePoeWarningModal();
    await sendControlAction(portId, "poe_enable");
}

async function sendControlAction(portId, action) {
    try {
        const res = await fetch(`/api/ports/${portId}/control`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: action })
        });
        const data = await res.json();
        
        if (!data.success) {
            alert(`⚠️ La commande matérielle n'a pas pu être appliquée sur le switch physique.\n\nAssurez-vous d'avoir indiqué le bon mot de passe de votre compte dans le menu '⚙️ Configuration'.`);
            await fetchStatus();
            return;
        }

        if (action === "poe_disable") {
            showToastNotification(`⚡ Alimentation PoE désactivée sur le Port ${portId} !`);
        } else if (action === "poe_enable") {
            showToastNotification(`⚡ Alimentation PoE activée sur le Port ${portId} !`);
        } else if (action === "disable") {
            showToastNotification(`Port ${portId} Désactivé (Power Off)`);
        } else if (action === "enable") {
            showToastNotification(`Port ${portId} Activé (Power On)`);
        }

        closeModal();
        await fetchStatus();
    } catch (err) {
        console.error("Control error:", err);
    }
}

async function handleSavePortMetadata(e) {
    e.preventDefault();
    const portId = parseInt(document.getElementById("edit-port-id").value, 10);
    const colorHex = document.getElementById("edit-color-picker").value;

    const payload = {
        custom_name: document.getElementById("edit-custom-name").value,
        cable_color: colorHex,
        cable_type: document.getElementById("edit-cable-type").value,
        patch_panel_port: document.getElementById("edit-patch-port").value,
        device_category: document.getElementById("edit-device-cat").value,
        notes: document.getElementById("edit-notes").value
    };

    try {
        const res = await fetch(`/api/ports/${portId}/metadata`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeModal();
            await fetchStatus();
        } else {
            alert("Erreur lors de la sauvegarde du port.");
        }
    } catch (err) {
        console.error("Error saving port metadata:", err);
    }
}

async function handleFreePort() {
    const portId = parseInt(document.getElementById("edit-port-id").value, 10);
    if (!confirm(`Voulez-vous vraiment libérer le port ${portId} et réinitialiser sa configuration visuelle ?`)) return;

    const payload = {
        custom_name: `Port ${portId}`,
        cable_color: "#64748b",
        cable_type: "Cat6",
        patch_panel_port: "",
        device_category: "other",
        notes: ""
    };

    try {
        const res = await fetch(`/api/ports/${portId}/metadata`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            closeModal();
            await fetchStatus();
        } else {
            alert("Erreur lors de la réinitialisation du port.");
        }
    } catch (err) {
        console.error("Error freeing port:", err);
    }
}

async function handleResetAllPorts() {
    if (!confirm("⚠️ ATTENTION : Voulez-vous vraiment libérer TOUS les 52 ports et réinitialiser la configuration pour repartir de zéro ? Cette action supprimera toutes les étiquettes et les raccordements.")) {
        return;
    }

    try {
        const res = await fetch("/api/ports/reset-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();
        if (data.success) {
            alert("Tous les ports ont été libérés avec succès ! Vous pouvez désormais tout reconfigurer à zéro.");
            await fetchStatus();
        } else {
            alert("Erreur lors de la réinitialisation globale des ports.");
        }
    } catch (err) {
        console.error("Error resetting all ports:", err);
    }
}

async function handleTogglePortState() {
    const portId = parseInt(document.getElementById("edit-port-id").value, 10);
    const port = appState.ports.find(p => p.port_id === portId);
    if (!port) return;

    const newAction = port.is_enabled ? "disable" : "enable";
    if (!confirm(`Voulez-vous vraiment ${newAction === 'enable' ? 'activer' : 'désactiver'} le port ${portId} sur le switch ?`)) return;

    await sendControlAction(portId, newAction);
}

async function handleBouncePoe() {
    const portId = parseInt(document.getElementById("edit-port-id").value, 10);
    if (!confirm(`Redémarrer l'alimentation PoE (Power Cycle) sur le port ${portId} ?`)) return;

    await sendControlAction(portId, "poe_bounce");
}

function openSettingsModal() {
    fetch("/api/config")
        .then(res => res.json())
        .then(cfg => {
            document.getElementById("cfg-ip").value = cfg.ip || "192.168.100.100";
            document.getElementById("cfg-protocol").value = cfg.protocol || "http";
            document.getElementById("cfg-port").value = cfg.port || 80;
            document.getElementById("cfg-username").value = cfg.username || "administrator";
            document.getElementById("cfg-password").value = "";
            const demoCheck = document.getElementById("cfg-demo-mode");
            if (demoCheck) demoCheck.checked = !!cfg.demo_mode;
            document.getElementById("modal-settings").classList.remove("hidden");
        });
}

function closeSettingsModal() {
    document.getElementById("modal-settings").classList.add("hidden");
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const demoCheck = document.getElementById("cfg-demo-mode");
    const payload = {
        ip: document.getElementById("cfg-ip").value,
        protocol: document.getElementById("cfg-protocol").value,
        port: parseInt(document.getElementById("cfg-port").value, 10),
        username: document.getElementById("cfg-username").value,
        password: document.getElementById("cfg-password").value,
        demo_mode: demoCheck ? demoCheck.checked : false
    };

    try {
        const res = await fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        closeSettingsModal();
        if (data.demo_mode) {
            alert("🎭 Mode Démo / Simulation activé avec succès ! Vous pouvez réaliser vos présentations en toute sécurité.");
        } else {
            alert(data.online ? "Connexion au switch réussie !" : "Configuration enregistrée, mais la connexion au switch a échoué.");
        }
        await fetchStatus();
    } catch (err) {
        console.error("Config save error:", err);
    }
}
