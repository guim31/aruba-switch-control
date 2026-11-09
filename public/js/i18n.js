/**
 * Minimal i18n module (English / French), no build step.
 *
 * - t(key, vars): looks up a string, picks a plural form when the entry is an
 *   object ({ one, other }) using vars.count, then fills {placeholders}.
 * - Static HTML is translated through data-i18n (text), data-i18n-html (trusted
 *   dictionary markup), data-i18n-placeholder, data-i18n-title and
 *   data-i18n-aria-label. Optional data-i18n-vars holds JSON placeholder values.
 * - setText / setHtml store the key on the element, so a language switch
 *   re-translates dynamic text too.
 */
(function () {
    const STORAGE_KEY = "lang";
    const SUPPORTED = ["en", "fr"];

    const DICT = {
        en: {
            "app.title": "HP 2530-48G-PoEP - Visual Switch Manager",

            "lang.label": "Language",

            "header.themeTitle": "Toggle theme",
            "theme.light": "Light mode",
            "theme.dark": "Dark mode",
            "header.demoBadge": "Demo mode",
            "header.refreshTitle": "Refresh data",
            "header.settings": "Settings",
            "header.settingsTitle": "Switch settings",
            "header.simulator": "SIMULATOR",
            "header.demoIp": "{ip} (demo)",

            "status.restActive": "REST API active",
            "status.demo": "Demo mode (simulated)",
            "status.offline": "Switch offline",
            "status.unreachable": "Switch offline / unreachable",
            "status.uptimeConnected": "Connected (live REST API)",
            "status.uptimeDemo": "Demo / simulation mode (safe)",
            "status.uptimeOffline": "Offline / unreachable",

            "error.connectionFailed": "Connection failed ({ip}): {detail}",
            "error.connecting": "Connecting to the switch…",
            "error.unexpected": "Error: {detail}",

            "kpi.activePorts": "Active ports",
            "kpi.portsPct": "{pct} connected",
            "kpi.poe": "PoE+ power draw",
            "kpi.poeOf": "of {max}",
            "kpi.connection": "Connection status",

            "unit.watts": "{value} W",
            "unit.mbps": "{value} Mbps",

            "toolbar.searchPlaceholder": "Search port (e.g. 12), name, VLAN or note…",
            "filter.allStatus": "All states",
            "filter.up": "Link UP (connected)",
            "filter.down": "Link DOWN (disconnected)",
            "filter.poe": "PoE active",
            "filter.disabled": "Disabled",
            "filter.allColors": "All cable colors",
            "filter.colorOption": "{name} ({hex})",
            "toolbar.filteredCount": {
                one: "{count} / {total} port shown",
                other: "{count} / {total} ports shown"
            },
            "toolbar.resetFilters": "Reset filters",
            "toolbar.freeAll": "Free ALL ports",

            "rack.title": "Network rack view (24-port patch panel + HP 2530-48G switch)",
            "rack.showCables": "Show cables",
            "rack.hideCables": "Hide cables",
            "rack.showPanel": "Show panel",
            "rack.hidePanel": "Hide panel",
            "rack.hint": "Turn on \"Show cables\" to draw the connected patch cords. Click a cable to change its color!",

            "panel.selectPort": "Select a port",
            "panel.cable": "Cable:",
            "panel.type": "Type:",
            "panel.patch": "Patch panel:",
            "panel.poe": "PoE:",
            "panel.noNotes": "No notes.",
            "panel.note": "Note: {notes}",
            "panel.notSet": "Not set",
            "panel.linkUp": "LINK UP ({speed})",
            "panel.poeDisabled": "Disabled",
            "panel.poeDelivering": "{watts} (powered)",
            "panel.poeSearching": "On (waiting / detecting)",
            "panel.edit": "Edit this port",

            "tip.switchPort": "Switch port {port} ({name})\n💡 Click to configure, Ctrl+click to multi-select, or drag to connect!",
            "tip.poeDelivering": "PoE powered ({watts})",
            "tip.poeSearching": "PoE on (detecting / waiting)",
            "tip.patchLinked": "Patch jack PP-{pp} -> connected to switch port {port} ({name})",
            "tip.patchPoe": "⚡ PoE power on ({watts})",
            "tip.patchLinkedHint": "💡 Click to edit, or drag to move the cable!",
            "tip.patchFree": "Patch jack PP-{pp} (free)",
            "tip.patchFreeHint": "💡 Hold the mouse button down to pull a cable!",

            "common.close": "Close",
            "common.cancel": "Cancel",
            "common.save": "Save",

            "color.red": "Red",
            "color.orange": "Orange",
            "color.yellow": "Yellow",
            "color.green": "Green",
            "color.blue": "Blue",
            "color.purple": "Purple",
            "color.pink": "Pink",
            "color.gray": "Gray",
            "color.white": "White",
            "color.black": "Black",

            "quickColor.title": "Cable color",
            "quickColor.switchPort": "Switch port",
            "quickColor.connected": "(connected to {pp})",
            "quickColor.choose": "Pick a new color:",
            "quickColor.custom": "Custom color:",

            "edit.title": "Edit port",
            "edit.subtitle": "Label, cable color and hardware options",
            "edit.name": "Device name / label",
            "edit.namePh": "e.g. ESXi server 01, Wi-Fi access point…",
            "edit.color": "Connected cable color",
            "edit.customColor": "Custom color",
            "edit.cableType": "Cable type",
            "cable.fiberMM": "Multimode fiber (MM)",
            "cable.fiberSM": "Single-mode fiber (SM)",
            "cable.dac": "Direct Attach Copper (DAC)",
            "edit.patch": "Patch panel jack (1-24)",
            "edit.patchPh": "e.g. PP1-04 or 4",
            "edit.category": "Device category",
            "cat.server": "Server / hypervisor",
            "cat.router": "Router / firewall",
            "cat.ap": "Wi-Fi access point",
            "cat.camera": "PoE IP camera",
            "cat.pc": "Workstation / PC",
            "cat.printer": "Printer",
            "cat.switch": "Switch / uplink",
            "cat.other": "Other / unknown",
            "edit.notes": "Notes",
            "edit.notesPh": "Extra details, static IP, required VLAN…",
            "edit.hwActions": "Hardware actions (REST API)",
            "edit.disablePort": "Disable port",
            "edit.togglePoe": "Toggle PoE",
            "edit.bouncePoe": "Restart PoE",
            "edit.free": "Free this port",
            "poe.enable": "Enable PoE",
            "poe.disable": "Disable PoE",

            "poeWarn.title": "⚠️ Security alert - hardware danger",
            "poeWarn.subtitle": "PoE confirmation on port",
            "poeWarn.heading": "Enabling 48 V PoE+ power",
            "poeWarn.body": "Sending PoE power to a <strong>non-compatible</strong> device (e.g. laptop, standard network card, printer) <strong>may permanently damage your equipment</strong>.",
            "poeWarn.certify": "I confirm that the device connected to port {port} supports PoE (IEEE 802.3af/at).",
            "poeWarn.confirm": "Confirm & enable PoE",

            "settings.title": "Switch settings",
            "settings.ip": "Switch IP address",
            "settings.protocol": "Protocol",
            "settings.port": "HTTP port",
            "settings.username": "Switch username (CLI & REST API)",
            "settings.password": "Manager password",
            "settings.passwordPh": "Manager account password",
            "settings.passwordHint": "💡 Enter the <strong>manager</strong> account password to unlock real hardware actions on the switch (PoE, restart, enable/disable).",
            "settings.demo": "Demo / simulation mode (safe)",
            "settings.demoHint": "Simulates a virtual test switch. Ideal for safe demos that never touch your real switch.",
            "settings.saveTest": "Save & test",

            "bulk.selected": { one: "port selected", other: "ports selected" },
            "bulk.hold": "Hold <kbd class=\"px-1 py-0.5 bg-slate-800 rounded border border-slate-600 text-slate-300 font-mono\">Ctrl</kbd>",
            "bulk.processing": "Processing…",
            "bulk.poeEnable": "Enable PoE",
            "bulk.poeEnableTitle": "Turn on PoE power on all selected ports",
            "bulk.poeDisable": "Disable PoE",
            "bulk.poeDisableTitle": "Cut PoE power on the selected ports",
            "bulk.poeBounce": "Restart PoE",
            "bulk.poeBounceTitle": "Power-cycle PoE (off, then on)",
            "bulk.portEnable": "Enable port",
            "bulk.portEnableTitle": "Enable the network interface of the selected ports",
            "bulk.portDisable": "Disable port",
            "bulk.portDisableTitle": "Shut down the interface of the selected ports",
            "bulk.free": "Free",
            "bulk.freeTitle": "Clear cabling details and free the ports",
            "bulk.clearTitle": "Clear selection",
            "bulk.action.poe_enable": "Enabling PoE",
            "bulk.action.poe_disable": "Disabling PoE",
            "bulk.action.poe_bounce": "Restarting PoE",
            "bulk.action.enable": "Enabling port",
            "bulk.action.disable": "Disabling port",
            "bulk.action.free": "Freeing port",
            "bulk.action.default": "Processing",
            "bulk.progress": "{action} on port {port} ({index}/{total})…",
            "bulk.succeeded": "{count} succeeded",
            "bulk.failed": "{count} failed",
            "bulk.done": {
                one: "⚡ Bulk action applied to {count} port ({summary})!",
                other: "⚡ Bulk action applied to {count} ports ({summary})!"
            },

            "toast.cableConnected": "🔌 Patch cord connected: panel jack PP-{pp} ↔️ switch port {port}!",
            "toast.colorUpdated": "🎨 Cable color updated ({color})!",
            "toast.poeOff": "⚡ PoE power turned off on port {port}!",
            "toast.poeOn": "⚡ PoE power turned on on port {port}!",
            "toast.portDisabled": "Port {port} disabled (power off)",
            "toast.portEnabled": "Port {port} enabled (power on)",

            "confirm.poeDisable": "Really TURN OFF PoE power on port {port} ({name})?",
            "confirm.freePort": "Really free port {port} and reset its visual settings?",
            "confirm.resetAll": "⚠️ WARNING: really free ALL 52 ports and start over from scratch? This removes every label and connection.",
            "confirm.enablePort": "Really enable port {port} on the switch?",
            "confirm.disablePort": "Really disable port {port} on the switch?",
            "confirm.bouncePoe": "Power-cycle PoE on port {port}?",

            "alert.hwFailed": "⚠️ The hardware command could not be applied to the physical switch.\n\nMake sure you entered the right account password in '⚙️ Settings'.",
            "alert.saveFailed": "Could not save the port.",
            "alert.freeFailed": "Could not reset the port.",
            "alert.resetAllDone": "All ports have been freed. You can now set everything up from scratch.",
            "alert.resetAllFailed": "Could not reset all ports.",
            "alert.demoOn": "🎭 Demo / simulation mode is on. You can run your demos safely.",
            "alert.connected": "Connected to the switch!",
            "alert.connectFailed": "Settings saved, but the switch could not be reached."
        },

        fr: {
            "app.title": "HP 2530-48G-PoEP - Visual Switch Manager",

            "lang.label": "Langue",

            "header.themeTitle": "Changer de thème",
            "theme.light": "Mode Clair",
            "theme.dark": "Mode Sombre",
            "header.demoBadge": "Mode Démo",
            "header.refreshTitle": "Rafraîchir les données",
            "header.settings": "Configuration",
            "header.settingsTitle": "Paramètres du switch",
            "header.simulator": "SIMULATEUR",
            "header.demoIp": "{ip} (Démo)",

            "status.restActive": "REST API Active",
            "status.demo": "Mode Démo (Simulé)",
            "status.offline": "Switch Hors-Ligne",
            "status.unreachable": "Switch Hors-ligne / Inaccessible",
            "status.uptimeConnected": "Connecté (REST API Live)",
            "status.uptimeDemo": "Mode Démo / Simulation (Sécurisé)",
            "status.uptimeOffline": "Hors-ligne / Inaccessible",

            "error.connectionFailed": "Connexion échouée ({ip}) : {detail}",
            "error.connecting": "Connexion au switch...",
            "error.unexpected": "Erreur : {detail}",

            "kpi.activePorts": "Ports Actifs",
            "kpi.portsPct": "{pct} connecté",
            "kpi.poe": "Consommation PoE+",
            "kpi.poeOf": "sur {max}",
            "kpi.connection": "État de connexion",

            "unit.watts": "{value} W",
            "unit.mbps": "{value} Mb/s",

            "toolbar.searchPlaceholder": "Rechercher port (ex: 12), nom, VLAN ou note...",
            "filter.allStatus": "Tous les états",
            "filter.up": "Link UP (Connecté)",
            "filter.down": "Link DOWN (Déconnecté)",
            "filter.poe": "PoE Actif",
            "filter.disabled": "Désactivé",
            "filter.allColors": "Toutes les couleurs de câble",
            "filter.colorOption": "{name} ({hex})",
            "toolbar.filteredCount": {
                one: "{count} / {total} port affiché",
                other: "{count} / {total} ports affichés"
            },
            "toolbar.resetFilters": "Réinitialiser filtres",
            "toolbar.freeAll": "Libérer TOUS les ports",

            "rack.title": "Vue Rack Réseau (Baie 24P + Switch HP 2530-48G)",
            "rack.showCables": "Afficher les Câbles",
            "rack.hideCables": "Masquer Câbles",
            "rack.showPanel": "Afficher Baie",
            "rack.hidePanel": "Masquer Baie",
            "rack.hint": "Activez \"Afficher les Câbles\" pour dessiner les jarretières raccordées. Cliquez directement sur un câble pour en changer la couleur !",

            "panel.selectPort": "Sélectionnez un port",
            "panel.cable": "Câble:",
            "panel.type": "Type:",
            "panel.patch": "Panneau Brassage:",
            "panel.poe": "PoE:",
            "panel.noNotes": "Aucune note particulière.",
            "panel.note": "Note: {notes}",
            "panel.notSet": "Non renseigné",
            "panel.linkUp": "LINK UP ({speed})",
            "panel.poeDisabled": "Désactivé",
            "panel.poeDelivering": "{watts} (Alimenté)",
            "panel.poeSearching": "Activé (En attente/Recherche)",
            "panel.edit": "Modifier ce port",

            "tip.switchPort": "Port Switch {port} ({name})\n💡 Cliquez pour configurer, CTRL+Clic pour sélection multiple, ou glissez pour relier !",
            "tip.poeDelivering": "PoE Alimenté ({watts})",
            "tip.poeSearching": "PoE Activé (En recherche/Attente)",
            "tip.patchLinked": "Prise Panneau PP-{pp} -> Raccordé au Port Switch {port} ({name})",
            "tip.patchPoe": "⚡ Alimentation PoE Active ({watts})",
            "tip.patchLinkedHint": "💡 Cliquez pour éditer ou glissez pour déplacer le câble !",
            "tip.patchFree": "Prise Panneau PP-{pp} (Libre)",
            "tip.patchFreeHint": "💡 Maintenez la souris enfoncée pour tirer un câble !",

            "common.close": "Fermer",
            "common.cancel": "Annuler",
            "common.save": "Enregistrer",

            "color.red": "Rouge",
            "color.orange": "Orange",
            "color.yellow": "Jaune",
            "color.green": "Vert",
            "color.blue": "Bleu",
            "color.purple": "Violet",
            "color.pink": "Rose",
            "color.gray": "Gris",
            "color.white": "Blanc",
            "color.black": "Noir",

            "quickColor.title": "Couleur du Câble",
            "quickColor.switchPort": "Port Switch",
            "quickColor.connected": "(Raccordé {pp})",
            "quickColor.choose": "Choisissez une nouvelle couleur :",
            "quickColor.custom": "Couleur sur mesure :",

            "edit.title": "Éditer le Port",
            "edit.subtitle": "Libellé, couleur du câble et options matérielles",
            "edit.name": "Nom / Libellé de l'équipement",
            "edit.namePh": "ex: Serveur ESXi 01, Borne Wi-Fi...",
            "edit.color": "Couleur du câble raccordé",
            "edit.customColor": "Couleur sur mesure",
            "edit.cableType": "Type de câble",
            "cable.fiberMM": "Fibre Multimode (MM)",
            "cable.fiberSM": "Fibre Singlemode (SM)",
            "cable.dac": "Direct Attach Copper (DAC)",
            "edit.patch": "Prise Panneau Brassage (1-24)",
            "edit.patchPh": "ex: PP1-04 ou 4",
            "edit.category": "Catégorie d'équipement",
            "cat.server": "Serveur / Hyperviseur",
            "cat.router": "Routeur / Firewall",
            "cat.ap": "Point d'accès Wi-Fi",
            "cat.camera": "Caméra IP PoE",
            "cat.pc": "Poste de travail / PC",
            "cat.printer": "Imprimante",
            "cat.switch": "Switch / Uplink",
            "cat.other": "Autre / Inconnu",
            "edit.notes": "Notes / Remarques",
            "edit.notesPh": "Informations complémentaires, IP fixe, VLAN requis...",
            "edit.hwActions": "Actions Matérielles (REST API)",
            "edit.disablePort": "Désactiver Port",
            "edit.togglePoe": "Toggl. PoE",
            "edit.bouncePoe": "Rebooter PoE",
            "edit.free": "Libérer ce port",
            "poe.enable": "Activer PoE",
            "poe.disable": "Désactiver PoE",

            "poeWarn.title": "⚠️ Alerte sécurité - Danger matériel",
            "poeWarn.subtitle": "Confirmation PoE sur Port",
            "poeWarn.heading": "Activation de la Tension 48V PoE+",
            "poeWarn.body": "Injecter du courant PoE sur un appareil <strong>non compatible</strong> (ex: PC portable, carte réseau standard, imprimante) présente un <strong>risque de détérioration définitive de vos équipements</strong>.",
            "poeWarn.certify": "Je certifie que l'équipement raccordé sur le Port {port} supporte la norme PoE (IEEE 802.3af/at).",
            "poeWarn.confirm": "Confirmer & Activer PoE",

            "settings.title": "Configuration Switch",
            "settings.ip": "Adresse IP du Switch",
            "settings.protocol": "Protocole",
            "settings.port": "Port HTTP",
            "settings.username": "Nom d'utilisateur Switch (CLI & REST API)",
            "settings.password": "Mot de passe Manager",
            "settings.passwordPh": "Mot de passe du compte manager",
            "settings.passwordHint": "💡 Indiquez le mot de passe du compte <strong>manager</strong> pour débloquer les actions physiques réelles sur le switch (PoE, Reboot, Enable/Disable).",
            "settings.demo": "Mode Démo / Simulation (Sécurisé)",
            "settings.demoHint": "Simule un switch d'essai virtuel. Idéal pour réaliser vos démonstrations en toute sécurité sans jamais impacter votre switch réel.",
            "settings.saveTest": "Sauvegarder & Tester",

            "bulk.selected": { one: "Port Sélectionné", other: "Ports Sélectionnés" },
            "bulk.hold": "Touche <kbd class=\"px-1 py-0.5 bg-slate-800 rounded border border-slate-600 text-slate-300 font-mono\">Ctrl</kbd> maintenue",
            "bulk.processing": "Traitement en cours...",
            "bulk.poeEnable": "Activer PoE",
            "bulk.poeEnableTitle": "Activer l'alimentation PoE sur tous les ports sélectionnés",
            "bulk.poeDisable": "Désactiver PoE",
            "bulk.poeDisableTitle": "Couper l'alimentation PoE sur les ports sélectionnés",
            "bulk.poeBounce": "Reboot PoE",
            "bulk.poeBounceTitle": "Rebooter le PoE (cycle d'extinction/rallumage)",
            "bulk.portEnable": "Activer Port",
            "bulk.portEnableTitle": "Activer l'interface réseau des ports sélectionnés",
            "bulk.portDisable": "Désactiver Port",
            "bulk.portDisableTitle": "Désactiver (Shutdown) l'interface des ports sélectionnés",
            "bulk.free": "Libérer",
            "bulk.freeTitle": "Effacer les informations de câblage et libérer les ports",
            "bulk.clearTitle": "Annuler la sélection",
            "bulk.action.poe_enable": "Activation PoE",
            "bulk.action.poe_disable": "Désactivation PoE",
            "bulk.action.poe_bounce": "Reboot PoE",
            "bulk.action.enable": "Activation Port",
            "bulk.action.disable": "Désactivation Port",
            "bulk.action.free": "Libération Port",
            "bulk.action.default": "Traitement",
            "bulk.progress": "{action} sur Port {port} ({index}/{total})...",
            "bulk.succeeded": { one: "{count} réussi", other: "{count} réussis" },
            "bulk.failed": { one: "{count} échec", other: "{count} échecs" },
            "bulk.done": {
                one: "⚡ Action de groupe effectuée sur {count} port ({summary}) !",
                other: "⚡ Action de groupe effectuée sur {count} ports ({summary}) !"
            },

            "toast.cableConnected": "🔌 Jarretière raccordée : Prise Baie PP-{pp} ↔️ Port Switch {port} !",
            "toast.colorUpdated": "🎨 Couleur du câble mise à jour ({color}) !",
            "toast.poeOff": "⚡ Alimentation PoE désactivée sur le Port {port} !",
            "toast.poeOn": "⚡ Alimentation PoE activée sur le Port {port} !",
            "toast.portDisabled": "Port {port} Désactivé (Power Off)",
            "toast.portEnabled": "Port {port} Activé (Power On)",

            "confirm.poeDisable": "Voulez-vous vraiment DÉSACTIVER l'alimentation PoE sur le Port {port} ({name}) ?",
            "confirm.freePort": "Voulez-vous vraiment libérer le port {port} et réinitialiser sa configuration visuelle ?",
            "confirm.resetAll": "⚠️ ATTENTION : Voulez-vous vraiment libérer TOUS les 52 ports et réinitialiser la configuration pour repartir de zéro ? Cette action supprimera toutes les étiquettes et les raccordements.",
            "confirm.enablePort": "Voulez-vous vraiment activer le port {port} sur le switch ?",
            "confirm.disablePort": "Voulez-vous vraiment désactiver le port {port} sur le switch ?",
            "confirm.bouncePoe": "Redémarrer l'alimentation PoE (Power Cycle) sur le port {port} ?",

            "alert.hwFailed": "⚠️ La commande matérielle n'a pas pu être appliquée sur le switch physique.\n\nAssurez-vous d'avoir indiqué le bon mot de passe de votre compte dans le menu '⚙️ Configuration'.",
            "alert.saveFailed": "Erreur lors de la sauvegarde du port.",
            "alert.freeFailed": "Erreur lors de la réinitialisation du port.",
            "alert.resetAllDone": "Tous les ports ont été libérés avec succès ! Vous pouvez désormais tout reconfigurer à zéro.",
            "alert.resetAllFailed": "Erreur lors de la réinitialisation globale des ports.",
            "alert.demoOn": "🎭 Mode Démo / Simulation activé avec succès ! Vous pouvez réaliser vos présentations en toute sécurité.",
            "alert.connected": "Connexion au switch réussie !",
            "alert.connectFailed": "Configuration enregistrée, mais la connexion au switch a échoué."
        }
    };

    function detectLanguage() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (SUPPORTED.includes(saved)) return saved;
        } catch (e) { /* storage unavailable */ }
        const nav = (navigator.language || "").toLowerCase();
        return nav.startsWith("fr") ? "fr" : "en";
    }

    let current = detectLanguage();

    function t(key, vars) {
        let entry = DICT[current][key];
        if (entry === undefined) entry = DICT.en[key];
        if (entry === undefined) {
            console.warn(`[i18n] missing key: ${key}`);
            return key;
        }
        if (typeof entry === "object") {
            const count = vars && typeof vars.count === "number" ? vars.count : 0;
            const form = new Intl.PluralRules(current).select(count);
            entry = entry[form] !== undefined ? entry[form] : entry.other;
        }
        if (!vars) return entry;
        return entry.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined ? String(vars[name]) : m));
    }

    function readVars(el) {
        const raw = el.getAttribute("data-i18n-vars");
        if (!raw) return undefined;
        try { return JSON.parse(raw); } catch (e) { return undefined; }
    }

    function writeVars(el, vars) {
        if (vars) el.setAttribute("data-i18n-vars", JSON.stringify(vars));
        else el.removeAttribute("data-i18n-vars");
    }

    function applyI18n(root) {
        const scope = root || document;
        const each = (attr, fn) => {
            if (scope.nodeType === 1 && scope.hasAttribute(attr)) fn(scope);
            scope.querySelectorAll(`[${attr}]`).forEach(fn);
        };
        each("data-i18n", el => { el.textContent = t(el.getAttribute("data-i18n"), readVars(el)); });
        each("data-i18n-html", el => { el.innerHTML = t(el.getAttribute("data-i18n-html"), readVars(el)); });
        each("data-i18n-placeholder", el => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder"))); });
        each("data-i18n-title", el => { el.setAttribute("title", t(el.getAttribute("data-i18n-title"))); });
        each("data-i18n-aria-label", el => { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label"))); });
    }

    // Set an element's text from a key; the key stays on the element so a language switch re-translates it.
    function setText(el, key, vars) {
        if (!el) return;
        el.removeAttribute("data-i18n-html");
        el.setAttribute("data-i18n", key);
        writeVars(el, vars);
        el.textContent = t(key, vars);
    }

    // Same as setText for dictionary strings holding trusted markup. Vars must be safe HTML.
    function setHtml(el, key, vars) {
        if (!el) return;
        el.removeAttribute("data-i18n");
        el.setAttribute("data-i18n-html", key);
        writeVars(el, vars);
        el.innerHTML = t(key, vars);
    }

    function formatNumber(value, options) {
        return new Intl.NumberFormat(current, options).format(value);
    }

    function formatPercent(ratio) {
        return formatNumber(ratio, { style: "percent", maximumFractionDigits: 0 });
    }

    function formatWatts(value) {
        return t("unit.watts", { value: formatNumber(Number(value) || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) });
    }

    function formatSpeed(mbps) {
        return t("unit.mbps", { value: formatNumber(Number(mbps) || 0) });
    }

    function updateLanguageButtons() {
        document.querySelectorAll("[data-lang-option]").forEach(btn => {
            const active = btn.getAttribute("data-lang-option") === current;
            btn.setAttribute("aria-pressed", active ? "true" : "false");
            btn.classList.toggle("lang-active", active);
        });
    }

    function setLanguage(lang) {
        if (!SUPPORTED.includes(lang) || lang === current) return;
        current = lang;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
        document.documentElement.lang = lang;
        applyI18n(document);
        updateLanguageButtons();
        document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang } }));
    }

    function getLanguage() {
        return current;
    }

    window.i18n = { t, setText, setHtml, applyI18n, setLanguage, getLanguage, formatNumber, formatPercent, formatWatts, formatSpeed };
    window.t = t;

    // Translate the static page right away (this script is loaded at the end of <body>).
    document.documentElement.lang = current;
    applyI18n(document);
    updateLanguageButtons();
    document.querySelectorAll("[data-lang-option]").forEach(btn => {
        btn.addEventListener("click", () => setLanguage(btn.getAttribute("data-lang-option")));
    });
})();
