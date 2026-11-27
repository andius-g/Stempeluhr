/* =========================================================
   STEMPELUHR & WOCHENÜBERSICHT — ANWENDUNGSLOGIK (VERSION 1.9.4)
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    const format2 = (val) => String(val).padStart(2, '0');
    const getTodayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${format2(now.getMonth() + 1)}-${format2(now.getDate())}`;
    };

    const versionLabelEl = document.getElementById("app-version-label");
    if (versionLabelEl) versionLabelEl.textContent = `Version ${typeof APP_VERSION !== "undefined" ? APP_VERSION : "1.9.4"}`;

    const liveTimeEl = document.getElementById("live-clock-time");
    const liveDayEl = document.getElementById("live-clock-day");
    const liveClockBox = document.getElementById("live-clock-box");
    const bgHourWatermark = document.getElementById("bg-hour-watermark");
    const edgeBgLayer = document.getElementById("edge-bg-layer");
    const metaThemeColor = document.getElementById("meta-theme-color");
    const weekdaysFull = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

    async function forceAppReload() {
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const reg of regs) await reg.update();
            }
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names.map(n => caches.delete(n)));
            }
        } catch (err) {}
        window.location.replace(`${window.location.href.split('?')[0]}?v=${Date.now()}`);
    }

    if (liveClockBox) {
        let longPressTimer = null;
        const startHold = () => {
            clearTimeout(longPressTimer);
            longPressTimer = setTimeout(() => {
                if (confirm("Notfall-Update jetzt ausführen und Cache leeren?")) {
                    forceAppReload();
                }
            }, 3000);
        };
        const cancelHold = () => clearTimeout(longPressTimer);
        liveClockBox.addEventListener("pointerdown", startHold);
        liveClockBox.addEventListener("pointerup", cancelHold);
        liveClockBox.addEventListener("pointerleave", cancelHold);
        liveClockBox.addEventListener("pointercancel", cancelHold);
    }

    function getCalendarWeek(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function applyThemeColors(hue, lightness) {
        document.documentElement.style.setProperty('--hue', hue);
        document.documentElement.style.setProperty('--lightness', lightness + '%');
        const bgHex = window.hslToHex(hue + 120, 42, 95);
        if (metaThemeColor) metaThemeColor.setAttribute("content", bgHex);
        document.documentElement.style.backgroundColor = bgHex;
        if (edgeBgLayer) edgeBgLayer.style.backgroundColor = bgHex;
    }

    function applyAsymIntensity(val) {
        const clamped = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
        document.documentElement.style.setProperty('--asym-intensity', (clamped / 100).toFixed(3));
        return clamped;
    }

    async function showAppNotification(title, body, tag) {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        const iconFile = localStorage.getItem("appIconTheme") === "rose" ? "./favicon_rose_192.png" : "./favicon_192.png";
        const options = {
            body,
            icon: iconFile,
            badge: iconFile,
            tag,
            renotify: true
        };
        try {
            if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.showNotification) {
                    await reg.showNotification(title, options);
                    return;
                }
            }
        } catch (e) {}
        try {
            new Notification(title, options);
        } catch (e) {}
    }

    const holidaysNds = {
        "2026-01-01": "Neujahr", "2026-04-03": "Karfreitag", "2026-04-06": "Ostermontag",
        "2026-05-01": "Tag der Arbeit", "2026-05-14": "Christi Himmelfahrt", "2026-05-25": "Pfingstmontag",
        "2026-10-03": "Tag d. Dt. Einheit", "2026-10-31": "Reformationstag", "2026-12-25": "1. Weihnachtstag", "2026-12-26": "2. Weihnachtstag",
        "2027-01-01": "Neujahr", "2027-03-26": "Karfreitag", "2027-03-29": "Ostermontag",
        "2027-05-01": "Tag der Arbeit", "2027-05-06": "Christi Himmelfahrt", "2027-05-17": "Pfingstmontag",
        "2027-10-03": "Tag d. Dt. Einheit", "2027-10-31": "Reformationstag", "2027-12-25": "1. Weihnachtstag", "2027-12-26": "2. Weihnachtstag",
        "2028-01-01": "Neujahr", "2028-04-14": "Karfreitag", "2028-04-17": "Ostermontag",
        "2028-05-01": "Tag der Arbeit", "2028-05-25": "Christi Himmelfahrt", "2028-06-05": "Pfingstmontag",
        "2028-10-03": "Tag d. Dt. Einheit", "2028-10-31": "Reformationstag", "2028-12-25": "1. Weihnachtstag", "2028-12-26": "2. Weihnachtstag"
    };
    const getHolidayName = (dateStr) => holidaysNds[dateStr] || null;

    function getDayData(dateStr) {
        try { return JSON.parse(localStorage.getItem("day_" + dateStr)) || null; }
        catch (e) { return null; }
    }
    const saveDayData = (dateStr, data) => localStorage.setItem("day_" + dateStr, JSON.stringify(data));

    function hasWeekendBooking(saved) {
        if (!saved) return false;
        const hasTimes = (saved.startH !== '' && saved.startH !== undefined)
            || (saved.endH !== '' && saved.endH !== undefined)
            || (Array.isArray(saved.sessions) && saved.sessions.length > 0);
        const hasSmoke = typeof saved.smokeCount === 'number' && saved.smokeCount > 0;
        const hasNonFreeStatus = saved.status && saved.status !== 'free' && saved.status !== 'work';
        return hasTimes || hasSmoke || hasNonFreeStatus;
    }

    /* =========================================================
       BACKUP-FUNKTIONEN (JSON EXPORT & IMPORT)
       ========================================================= */
    const backupStatusPill = document.getElementById("backup-status-pill");
    const backupFileInput = document.getElementById("backup-file-input");

    function updateBackupStatusBadge() {
        if (!backupStatusPill) return;
        const lastIso = localStorage.getItem("lastBackupDate");
        backupStatusPill.classList.remove("is-due");

        if (!lastIso) {
            backupStatusPill.textContent = "Noch kein Backup";
            backupStatusPill.classList.add("is-due");
            return;
        }
        const lastMs = Date.parse(lastIso);
        if (isNaN(lastMs)) {
            backupStatusPill.textContent = "Gesichert";
            return;
        }
        const diffDays = Math.floor((Date.now() - lastMs) / 86400000);
        if (diffDays <= 0) backupStatusPill.textContent = "Heute gesichert";
        else if (diffDays === 1) backupStatusPill.textContent = "Vor 1 Tag";
        else if (diffDays >= 30) {
            backupStatusPill.textContent = `Vor ${diffDays} Tagen!`;
            backupStatusPill.classList.add("is-due");
        } else {
            backupStatusPill.textContent = `Vor ${diffDays} Tagen`;
        }
    }

    function exportBackupJson() {
        const payload = {
            app: "Stempeluhr",
            version: typeof APP_VERSION !== "undefined" ? APP_VERSION : "1.9.4",
            exportedAt: new Date().toISOString(),
            storage: {}
        };
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) payload.storage[key] = localStorage.getItem(key);
        }
        const todayStr = getTodayStr();
        const safeName = (localStorage.getItem("userName") || "").trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
        const fileName = safeName ? `Stempeluhr_Backup_${todayStr}_${safeName}.json` : `Stempeluhr_Backup_${todayStr}.json`;

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);

        localStorage.setItem("lastBackupDate", new Date().toISOString());
        updateBackupStatusBadge();
    }

    document.getElementById("btn-export-backup").addEventListener("click", exportBackupJson);
    document.getElementById("btn-import-backup").addEventListener("click", () => {
        backupFileInput.value = "";
        backupFileInput.click();
    });

    backupFileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                if (!parsed || parsed.app !== "Stempeluhr" || typeof parsed.storage !== "object" || !parsed.storage) {
                    alert("Ungültige Datei: Dies ist kein gültiges Stempeluhr-Backup.");
                    return;
                }
                const keys = Object.keys(parsed.storage);
                const dayCount = keys.filter(k => k.startsWith("day_")).length;
                const exportInfo = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString("de-DE") : "unbekannt";
                if (!confirm(`Backup vom ${exportInfo} (${dayCount} gespeicherte Tage) einspielen?\n\nAktuelle Einträge werden ersetzt.`)) return;

                localStorage.clear();
                keys.forEach((k) => {
                    if (typeof parsed.storage[k] === "string") localStorage.setItem(k, parsed.storage[k]);
                });
                alert("Backup erfolgreich wiederhergestellt! Die App wird neu geladen.");
                window.location.reload();
            } catch (err) {
                alert("Fehler beim Lesen der Backup-Datei.");
            }
        };
        reader.readAsText(file);
    });

    /* =========================================================
       SCRIBBLE SVG-SET (32 MOTIVE AUS EINEM GUSS)
       ========================================================= */
    const SCRIBBLE_ICONS = [
        { id: "bolt", label: "Blitz", inner: `<path d="M20.5 3.5 L8.5 19.5 L18 19.2 L14.8 32.5 L27.5 16.2 L18.2 16.5 Z"/>` },
        { id: "loop-arrow", label: "Schleife", inner: `<path d="M5 24 C10 26, 22 23, 21 15 C20 10, 13 11, 14 17 C15 23, 25 22, 30 13 M24 12.5 L30.5 12.5 L29.5 19"/>` },
        { id: "star", label: "Stern", inner: `<path d="M18 4 L21.4 13.4 L31.5 13.8 L23.5 19.8 L26.3 29.8 L18 23.8 L9.7 29.8 L12.5 19.8 L4.5 13.8 L14.6 13.4 Z"/>` },
        { id: "spiral", label: "Spirale", inner: `<path d="M18 18 C19.5 17, 21 19, 19.5 21 C17 23.5, 13 21.5, 13.5 18 C14 13, 20.5 11.5, 24 15.5 C28 20, 24.5 27.5, 18 28 C10 28.5, 6 21, 8.5 13.5 C11 6.5, 20.5 4.5, 27.5 9.5"/>` },
        { id: "cloud", label: "Wolke", inner: `<path d="M10 26.5 H26.5 C30 26.5, 32 24, 31.5 21 C31 18, 28.2 16.8, 26 17.2 C25.2 12.2, 20.2 9.8, 15.8 11.8 C12.5 13.2, 11.2 16.5, 11.5 18.8 C8 18.8, 5.2 21, 5.5 23.8 C5.8 25.8, 7.8 26.5, 10 26.5 Z"/>` },
        { id: "coffee", label: "Kaffee", inner: `<path d="M7 15 H24 V24 C24 28, 20.5 30, 15.5 30 C10.5 30, 7 28, 7 24 Z M24 17.5 H27.5 C29.8 17.5, 31 19.2, 30.8 21.5 C30.5 23.8, 28.5 25, 24 24.8 M11.5 11 C11 9, 13 8, 12.2 6 M17.5 11 C17 9, 19 8, 18.2 6"/>` },
        { id: "crown", label: "Krone", inner: `<path d="M6 25.5 L4.5 12 L12.5 18.5 L18 9.5 L23.5 18.5 L31.5 12 L30 25.5 Z M6.5 29 H29.5"/>` },
        { id: "heart", label: "Herz", inner: `<path d="M18 30 C18 30, 5.5 21.5, 5.5 13.2 C5.5 8.8, 9.2 6, 13.2 6.5 C15.8 6.8, 17.4 8.6, 18 10.4 C18.6 8.6, 20.2 6.8, 22.8 6.5 C26.8 6, 30.5 8.8, 30.5 13.2 C30.5 21.5, 18 30, 18 30 Z"/>` },
        { id: "sun", label: "Sonne", inner: `<circle cx="18" cy="18" r="6.5"/><path d="M18 4.5 V8 M18 28 V31.5 M4.5 18 H8 M28 18 H31.5 M8.5 8.5 L11 11 M25 25 L27.5 27.5 M27.5 8.5 L25 11 M11 25 L8.5 27.5"/>` },
        { id: "note", label: "Musik", inner: `<path d="M14 26.5 V9.5 L27.5 6.5 V23.5 M14 14.5 L27.5 11.5"/><circle cx="10.8" cy="26.8" r="3.4"/><circle cx="24.3" cy="23.8" r="3.4"/>` },
        { id: "clover", label: "Klee", inner: `<path d="M18 17.5 C13 15.5, 13.5 8.5, 18 8.5 C22.5 8.5, 23 15.5, 18 17.5 Z M18 17.5 C20 12.5, 27 13, 27 17.5 C27 22, 20 22.5, 18 17.5 Z M18 17.5 C16 12.5, 9 13, 9 17.5 C9 22, 16 22.5, 18 17.5 Z M18 17.5 C21 21, 19.5 28, 15.5 31.5"/>` },
        { id: "planet", label: "Saturn", inner: `<circle cx="18" cy="18" r="7.5"/><path d="M5.5 22.5 C3.5 19.5, 8.5 15.5, 16.8 13.5 C25 11.5, 31.5 12, 30.8 15.2 C30 18.5, 24.5 22, 16.5 24 C10.5 25.5, 7 24.8, 5.5 22.5 Z"/>` },

        { id: "arrow-wave", label: "Wellenpfeil", inner: `<path d="M5 18 C8.5 13, 12 23, 15.5 18 C19 13, 22.5 23, 26 18 H31 M26.5 13.5 L31.5 18 L26.5 22.5"/>` },
        { id: "check-mark", label: "Haken", inner: `<path d="M6.5 19 L14 26.5 L29.5 9.5"/>` },
        { id: "cross-x", label: "Kreuz", inner: `<path d="M8.5 8.5 L27.5 27.5 M27.5 8.5 L8.5 27.5"/>` },
        { id: "infinity", label: "Unendlich", inner: `<path d="M12.5 12.5 C7.5 12.5, 5.5 15.5, 5.5 18 C5.5 20.5, 7.5 23.5, 12.5 23.5 C16.5 23.5, 19.5 12.5, 23.5 12.5 C28.5 12.5, 30.5 15.5, 30.5 18 C30.5 20.5, 28.5 23.5, 23.5 23.5 C19.5 23.5, 16.5 12.5, 12.5 12.5 Z"/>` },
        { id: "rainbow", label: "Regenbogen", inner: `<path d="M5.5 25 A12.5 12.5 0 0 1 30.5 25 M10 25 A8 8 0 0 1 26 25 M14.5 25 A3.5 3.5 0 0 1 21.5 25"/>` },
        { id: "crescent", label: "Halbmond", inner: `<path d="M24.5 7.5 A12 12 0 1 0 27.5 25.5 A9.5 9.5 0 1 1 24.5 7.5 Z"/>` },
        { id: "smiley", label: "Smiley", inner: `<circle cx="18" cy="18" r="11.5"/><circle cx="14" cy="15.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="22" cy="15.5" r="1.3" fill="currentColor" stroke="none"/><path d="M13 20.5 C14.5 23.5, 21.5 23.5, 23 20.5"/>` },
        { id: "grid-hash", label: "Gitter", inner: `<path d="M14 7.5 V28.5 M22 7.5 V28.5 M7.5 14 H28.5 M7.5 22 H28.5"/>` },

        { id: "blossom", label: "Blüte", inner: `<circle cx="18" cy="18" r="3.5"/><path d="M18 14.5 C15 11.5, 15 6.5, 18 6.5 C21 6.5, 21 11.5, 18 14.5 Z M21.5 18 C24.5 15, 29.5 15, 29.5 18 C29.5 21, 24.5 21, 21.5 18 Z M18 21.5 C21 24.5, 21 29.5, 18 29.5 C15 29.5, 15 24.5, 18 21.5 Z M14.5 18 C11.5 21, 6.5 21, 6.5 18 C6.5 15, 11.5 15, 14.5 18 Z"/>` },
        { id: "stem-flower", label: "Blume", inner: `<path d="M18 31 V16 M18 25 C14 25, 12 22.5, 12 20.5 C15 20.5, 17 22.5, 18 25 Z M18 23 C22 23, 24 20.5, 24 18.5 C21 18.5, 19 20.5, 18 23 Z"/><path d="M12 11.5 C12 7.5, 15 5.5, 18 5.5 C21 5.5, 24 7.5, 24 11.5 C24 14.5, 21 16, 18 16 C15 16, 12 14.5, 12 11.5 Z"/>` },
        { id: "leaf", label: "Blatt", inner: `<path d="M8 28 C8 15, 17 8, 28 8 C28 19, 21 28, 8 28 Z M6.5 29.5 L21 15"/>` },
        { id: "butterfly", label: "Schmetterling", inner: `<path d="M18 11 V26 M18 15.5 C13.5 9.5, 6.5 10.5, 7.5 16.5 C8.2 20, 13.5 19.5, 18 18.5 M18 15.5 C22.5 9.5, 29.5 10.5, 28.5 16.5 C27.8 20, 22.5 19.5, 18 18.5 M18 18.5 C13.5 19, 9 22, 10.5 26.5 C11.8 29.5, 16.5 27.5, 18 23 M18 18.5 C22.5 19, 27 22, 25.5 26.5 C24.2 29.5, 19.5 27.5, 18 23"/>` },
        { id: "sunflower", label: "Sonnenblume", inner: `<circle cx="18" cy="18" r="5"/><path d="M18 5.5 V11 M18 25 V30.5 M5.5 18 H11 M25 18 H30.5 M9 9 L13 13 M23 23 L27 27 M27 9 L23 13 M13 23 L9 27"/>` },
        { id: "tulip", label: "Tulpe", inner: `<path d="M18 31 V19 M11 10 L14.5 14 L18 8.5 L21.5 14 L25 10 V15.5 C25 18.5, 21.8 20.5, 18 20.5 C14.2 20.5, 11 18.5, 11 15.5 Z"/>` },
        { id: "sprout", label: "Keimling", inner: `<path d="M18 31 V17 M18 21 C12 21, 7.5 17, 7.5 12.5 C13.5 12.5, 17.5 16, 18 21 Z M18 18 C23.5 18, 28.5 14, 28.5 9.5 C22.5 9.5, 18.5 13, 18 18 Z"/>` },
        { id: "daisy", label: "Gänseblümchen", inner: `<circle cx="18" cy="18" r="3.2"/><path d="M18 6.5 C20.5 6.5, 21.5 10.5, 19.5 14.5 M28.5 14.5 C29.5 17, 26.5 19.5, 21.5 18.5 M24.5 28 C22.5 29.5, 19.5 27, 18.5 21.5 M11.5 28 C9.5 26.5, 11 22.5, 15.5 20.5 M7.5 14.5 C6.5 12, 10.5 10.5, 15.5 15.5"/>` },

        { id: "rocket", label: "Rakete", inner: `<path d="M18 5 C23.5 9.5, 24.5 16.5, 22 23.5 H14 C11.5 16.5, 12.5 9.5, 18 5 Z"/><circle cx="18" cy="14.5" r="2.8"/><path d="M14 19.5 L9.5 24 L14 23.5 M22 19.5 L26.5 24 L22 23.5 M15.5 25.5 L18 31 L20.5 25.5"/>` },
        { id: "comet", label: "Komet", inner: `<circle cx="22.5" cy="14.5" r="5.5"/><path d="M17.5 12.5 L6.5 9.5 M17 15.5 L5 16.5 M18.5 18.5 L9 24.5 M20.5 20 L15.5 28.5"/>` },
        { id: "earth", label: "Planet", inner: `<circle cx="18" cy="18" r="11"/><path d="M10.5 11.5 C13.5 12.5, 15 15, 13.5 17.5 C12 20, 14.5 22.5, 17 22 C19.5 21.5, 21 24, 22.5 26.5 M22 10.5 C20 12.5, 21.5 15.5, 25 15"/>` },
        { id: "orbit", label: "Umlaufbahn", inner: `<circle cx="18" cy="18" r="5.5"/><ellipse cx="18" cy="18" rx="13.5" ry="5.5" transform="rotate(-24 18 18)"/><circle cx="29" cy="13" r="2.2"/>` }
    ];
    const makeScribbleSvg = (iconObj) => `<svg viewBox="0 0 36 36">${iconObj.inner}</svg>`;

    let userName = localStorage.getItem("userName") || "";
    let appStyleMode = localStorage.getItem("appStyleMode") === "asymmetric" ? "asymmetric" : "classic";
    let appAsymIntensity = parseInt(localStorage.getItem("appAsymIntensity"), 10);
    if (isNaN(appAsymIntensity)) appAsymIntensity = 55;

    let appHue = parseInt(localStorage.getItem("appHue"), 10);
    if (isNaN(appHue)) appHue = 195;

    let appLightness = parseInt(localStorage.getItem("appLightness"), 10);
    if (isNaN(appLightness)) appLightness = 44;
    appLightness = Math.min(52, Math.max(28, appLightness));

    let sollHours = parseInt(localStorage.getItem("sollHours"), 10);
    if (isNaN(sollHours)) sollHours = 8;
    let sollMinutes = parseInt(localStorage.getItem("sollMinutes"), 10);
    if (isNaN(sollMinutes)) sollMinutes = 0;

    let weeklyHours = parseFloat(localStorage.getItem("weeklyHours"));
    if (isNaN(weeklyHours) || weeklyHours <= 0) weeklyHours = 40;
    let glzBaseHours = parseFloat(localStorage.getItem("glzBaseHours"));
    if (isNaN(glzBaseHours)) glzBaseHours = 0;
    let glzBaseDate = localStorage.getItem("glzBaseDate") || "";

    let pauseNotifyEnabled = localStorage.getItem("pauseNotifyEnabled") === "true";
    let pauseNotifyLeadMins = parseInt(localStorage.getItem("pauseNotifyLeadMins"), 10);
    if (isNaN(pauseNotifyLeadMins) || pauseNotifyLeadMins < 1) pauseNotifyLeadMins = 10;

    let sollWidgetEnabled = localStorage.getItem("sollWidgetEnabled") !== "false";
    let sollWidgetMode = localStorage.getItem("sollWidgetMode") || "both";
    if (!["go", "come", "both"].includes(sollWidgetMode)) sollWidgetMode = "both";

    let pauseWatcherEnabled = localStorage.getItem("pauseWatcherEnabled") !== "false";
    let pauseWatcherMode = localStorage.getItem("pauseWatcherMode") || "both";
    if (!["go", "come", "both"].includes(pauseWatcherMode)) pauseWatcherMode = "both";

    let keyboardMode = localStorage.getItem("keyboardMode") === "system" ? "system" : "app";

    let isSmoker = localStorage.getItem("isSmoker") === "true";
    let smokeMinutesPerBreak = parseInt(localStorage.getItem("smokeMinutesPerBreak"), 10);
    if (isNaN(smokeMinutesPerBreak) || smokeMinutesPerBreak < 1) smokeMinutesPerBreak = 5;

    let gesturesEnabled = localStorage.getItem("gesturesEnabled") !== "false";

    let selectedScribbles = ["bolt", "loop-arrow"];
    try {
        const rawArr = JSON.parse(localStorage.getItem("selectedScribbles"));
        if (Array.isArray(rawArr)) {
            selectedScribbles = rawArr.filter(id => SCRIBBLE_ICONS.some(ic => ic.id === id)).slice(0, 5);
        }
    } catch (e) {}

    let scribbleSizePct = parseInt(localStorage.getItem("scribbleSizePct"), 10);
    if (isNaN(scribbleSizePct)) scribbleSizePct = 50;
    scribbleSizePct = Math.min(100, Math.max(15, scribbleSizePct));

    let scribbleAccordionOpen = false;
    let appIconTheme = localStorage.getItem("appIconTheme") === "rose" ? "rose" : "blue";

    function syncIconThemePickerUI() {
        document.querySelectorAll("#icon-variant-grid .icon-variant-card").forEach((card) => {
            card.classList.toggle("selected", card.getAttribute("data-icon-theme") === appIconTheme);
        });
    }
    syncIconThemePickerUI();

    document.querySelectorAll("#icon-variant-grid .icon-variant-card").forEach((card) => {
        card.addEventListener("click", () => {
            appIconTheme = card.getAttribute("data-icon-theme") === "rose" ? "rose" : "blue";
            localStorage.setItem("appIconTheme", appIconTheme);
            if (window.applyAppIconTheme) window.applyAppIconTheme(appIconTheme);
            syncIconThemePickerUI();
            updateSettingsNavPreviews();
        });
    });

    let todaySmokeCount = 0;
    const initialTodayData = getDayData(getTodayStr());
    if (initialTodayData && typeof initialTodayData.smokeCount === "number") {
        todaySmokeCount = initialTodayData.smokeCount;
    }

    document.documentElement.setAttribute("data-style", appStyleMode);
    applyAsymIntensity(appAsymIntensity);
    applyThemeColors(appHue, appLightness);

    const scribbleAccordionCard = document.getElementById("scribble-accordion-card");
    const btnToggleScribbleAccordion = document.getElementById("btn-toggle-scribble-accordion");
    const scribbleAccordionMeta = document.getElementById("scribble-accordion-meta");
    const scribbleMiniStrip = document.getElementById("scribble-mini-strip");
    const scribbleSvgGrid = document.getElementById("scribble-svg-grid");
    const scribbleCountTag = document.getElementById("scribble-count-tag");
    const scribbleSizeSlider = document.getElementById("scribbleSizeSlider");
    const scribbleSizeVal = document.getElementById("scribbleSizeVal");
    const navWorkSummary = document.getElementById("nav-work-summary");
    const navWidgetsSummary = document.getElementById("nav-widgets-summary");
    const navDesignSummary = document.getElementById("nav-design-summary");

    function syncScribbleAccordionUI() {
        scribbleAccordionCard.classList.toggle("is-open", scribbleAccordionOpen);
        btnToggleScribbleAccordion.setAttribute("aria-expanded", scribbleAccordionOpen ? "true" : "false");
        scribbleAccordionMeta.textContent = `${selectedScribbles.length}/5 aktiv · Größe ${scribbleSizePct}% · ${scribbleAccordionOpen ? "Zuklappen" : "Aufklappen"}`;
        scribbleMiniStrip.innerHTML = "";
        if (selectedScribbles.length === 0) {
            scribbleMiniStrip.innerHTML = `<span style="font-size:0.68em; color:#fff; opacity:0.8;">aus</span>`;
        } else {
            selectedScribbles.forEach(id => {
                const found = SCRIBBLE_ICONS.find(ic => ic.id === id);
                if (found) scribbleMiniStrip.innerHTML += makeScribbleSvg(found);
            });
        }
    }

    btnToggleScribbleAccordion.addEventListener("click", () => {
        scribbleAccordionOpen = !scribbleAccordionOpen;
        syncScribbleAccordionUI();
    });

    function updateSettingsNavPreviews() {
        if (navWorkSummary) {
            const smokeTxt = isSmoker ? `Raucher ${smokeMinutesPerBreak}m` : "Raucher aus";
            const pushTxt = pauseNotifyEnabled ? ` · Push ${pauseNotifyLeadMins}m` : "";
            navWorkSummary.textContent = `${format2(sollHours)}:${format2(sollMinutes)}/Tag · ${weeklyHours}h/Wo · ${smokeTxt}${pushTxt}`;
        }
        if (navWidgetsSummary) {
            const kbTxt = keyboardMode === "system" ? "System-Tastatur" : "App-Tastatur";
            const wTxt = sollWidgetEnabled || pauseWatcherEnabled ? "Widgets aktiv" : "Widgets aus";
            navWidgetsSummary.textContent = `${wTxt} · ${kbTxt}`;
        }
        if (navDesignSummary) {
            const styleTxt = appStyleMode === "asymmetric" ? `Asymmetrisch (${appAsymIntensity}%)` : "Klassisch";
            const iconTxt = appIconTheme === "rose" ? "Icon Rosé" : "Icon Blau";
            navDesignSummary.textContent = `${styleTxt} · ${selectedScribbles.length} Scribbles · ${iconTxt}`;
        }
    }

    function renderScribblePicker() {
        scribbleCountTag.textContent = `${selectedScribbles.length} / 5`;
        syncScribbleAccordionUI();
        scribbleSvgGrid.innerHTML = "";
        SCRIBBLE_ICONS.forEach(item => {
            const isSel = selectedScribbles.includes(item.id);
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "scribble-svg-chip" + (isSel ? " selected" : "");
            btn.title = item.label;
            btn.innerHTML = `${makeScribbleSvg(item)}<span>${item.label}</span>`;
            btn.addEventListener("click", () => {
                const idx = selectedScribbles.indexOf(item.id);
                if (idx >= 0) selectedScribbles.splice(idx, 1);
                else {
                    if (selectedScribbles.length >= 5) selectedScribbles.shift();
                    selectedScribbles.push(item.id);
                }
                renderScribblePicker();
            });
            scribbleSvgGrid.appendChild(btn);
        });
    }

    scribbleSizeSlider.addEventListener("input", () => {
        scribbleSizePct = parseInt(scribbleSizeSlider.value, 10);
        scribbleSizeVal.textContent = scribbleSizePct;
        syncScribbleAccordionUI();
    });

    /* =========================================================
       SCREEN 1: START (KOMMEN / GEHEN) + SCRIBBLES + WIDGETS
       ========================================================= */
    const welcomeOverlay = document.getElementById("welcome-overlay");
    const welcomeScatterField = document.getElementById("welcome-scatter-field");
    const welcomeGreetingEl = document.getElementById("welcome-greeting");
    const welcomeDateSubEl = document.getElementById("welcome-date-sub");
    const welcomeBigClockEl = document.getElementById("welcome-big-clock");
    const btnWelcomeAction = document.getElementById("btn-welcome-action");
    const welcomeActionTitle = document.getElementById("welcome-action-title");
    const welcomeActionSub = document.getElementById("welcome-action-sub");
    const btnWelcomeMenu = document.getElementById("btn-welcome-menu");

    const welcomeSollWidget = document.getElementById("welcome-soll-widget");
    const wswBadge = document.getElementById("wsw-badge");
    const wswSollInfo = document.getElementById("wsw-soll-info");
    const wswTargetTime = document.getElementById("wsw-target-time");

    const welcomePauseWidget = document.getElementById("welcome-pause-widget");
    const wpwBadge = document.getElementById("wpw-badge");
    const wpwLimitTime = document.getElementById("wpw-limit-time");
    const wpwCountdown = document.getElementById("wpw-countdown");

    let welcomeActionMode = "come";
    let ambientAnimTimer = null;

    function formatSecsToHhMmSs(totalSecs) {
        const s = Math.max(0, Math.floor(totalSecs));
        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = s % 60;
        return `${format2(hh)}:${format2(mm)}:${format2(ss)}`;
    }

    function updateWelcomeSollWidget() {
        if (!welcomeSollWidget) return;

        if (!sollWidgetEnabled || !welcomeOverlay.classList.contains("active")) {
            welcomeSollWidget.style.display = "none";
            return;
        }

        const modeMatches = (sollWidgetMode === "both")
            || (sollWidgetMode === "go" && welcomeActionMode === "go")
            || (sollWidgetMode === "come" && welcomeActionMode === "come");

        if (!modeMatches) {
            welcomeSollWidget.style.display = "none";
            return;
        }

        const pS = getParsedStart();
        const pE = getParsedEnd();
        const sollTotalSecs = (sollHours * 3600) + (sollMinutes * 60);
        if (!pS || pE || sollTotalSecs <= 0) {
            welcomeSollWidget.style.display = "none";
            return;
        }

        const stH = parseInt(pS.h, 10);
        const stM = parseInt(pS.m, 10) || 0;
        const stS = (todaySessions.length > 0 && todaySessions[0].start) ? (parseInt(todaySessions[0].start.s, 10) || 0) : 0;
        const { totalGapSecs } = getSessionMetrics(null);
        const smokeSecs = getTodaySmokeSecs();

        let requiredPauseSecs = 0;
        if (sollTotalSecs >= 9 * 3600) requiredPauseSecs = 45 * 60;
        else if (sollTotalSecs >= 6 * 3600) requiredPauseSecs = 30 * 60;
        const extraDeductSecs = Math.max(requiredPauseSecs, smokeSecs);

        const startDate = new Date();
        startDate.setHours(stH, stM, stS, 0);
        const targetDate = new Date(startDate.getTime() + (sollTotalSecs + totalGapSecs + extraDeductSecs) * 1000);

        wswBadge.textContent = "Soll erreicht um";
        wswSollInfo.textContent = `Soll ${format2(sollHours)}:${format2(sollMinutes)}h`;
        wswTargetTime.textContent = `${format2(targetDate.getHours())}:${format2(targetDate.getMinutes())}:${format2(targetDate.getSeconds())}`;
        welcomeSollWidget.style.display = "flex";
    }

    function updateWelcomePauseWidget() {
        if (!welcomePauseWidget) return;

        if (!pauseWatcherEnabled || !welcomeOverlay.classList.contains("active")) {
            welcomePauseWidget.style.display = "none";
            return;
        }

        const modeMatches = (pauseWatcherMode === "both")
            || (pauseWatcherMode === "go" && welcomeActionMode === "go")
            || (pauseWatcherMode === "come" && welcomeActionMode === "come");

        if (!modeMatches) {
            welcomePauseWidget.style.display = "none";
            return;
        }

        const pS = getParsedStart();
        const pE = getParsedEnd();
        if (!pS || pE) {
            welcomePauseWidget.style.display = "none";
            return;
        }

        const stH = parseInt(pS.h, 10);
        const stM = parseInt(pS.m, 10) || 0;
        const stS = (todaySessions.length > 0 && todaySessions[0].start) ? (parseInt(todaySessions[0].start.s, 10) || 0) : 0;
        const startSecs = (stH * 3600) + (stM * 60) + stS;
        const nowSecs = getNowSecsOfDay();

        if (nowSecs < startSecs) {
            welcomePauseWidget.style.display = "none";
            return;
        }

        const { totalGapSecs } = getSessionMetrics(null);
        let totalPresSecs = nowSecs - startSecs;
        if (todaySessions.length > 1) {
            const metrics = getSessionMetrics(nowSecs);
            if (metrics.totalPresSecs > 0) totalPresSecs = metrics.totalPresSecs;
        }

        const startDate = new Date();
        startDate.setHours(stH, stM, stS, 0);
        const addClock = (s) => {
            const d = new Date(startDate.getTime() + (s + totalGapSecs) * 1000);
            return `${format2(d.getHours())}:${format2(d.getMinutes())}:${format2(d.getSeconds())}`;
        };

        const limit30TargetSecs = 6 * 3600 + 29 * 60 + 59;
        const start45PhaseSecs  = 6 * 3600 + 30 * 60;
        const limit45TargetSecs = 9 * 3600 + 44 * 60 + 59;

        if (totalPresSecs <= limit30TargetSecs) {
            const remainingSecs = limit30TargetSecs - totalPresSecs;
            welcomePauseWidget.classList.remove("is-warner-45");
            wpwBadge.textContent = "30-Min-Grenze";
            wpwLimitTime.textContent = `bis ${addClock(limit30TargetSecs)}`;
            wpwCountdown.textContent = formatSecsToHhMmSs(remainingSecs);
            welcomePauseWidget.style.display = "flex";
        } else if (totalPresSecs >= start45PhaseSecs && totalPresSecs <= limit45TargetSecs) {
            const remainingSecs = limit45TargetSecs - totalPresSecs;
            welcomePauseWidget.classList.add("is-warner-45");
            wpwBadge.textContent = "45er-Warner";
            wpwLimitTime.textContent = `bis ${addClock(limit45TargetSecs)}`;
            wpwCountdown.textContent = formatSecsToHhMmSs(remainingSecs);
            welcomePauseWidget.style.display = "flex";
        } else {
            welcomePauseWidget.style.display = "none";
        }
    }

    function updateWelcomeWidgets() {
        updateWelcomeSollWidget();
        updateWelcomePauseWidget();
    }

    function createSeededRng(seedNum) {
        let s = seedNum % 2147483647;
        if (s <= 0) s += 2147483646;
        return () => {
            s = (s * 16807) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    function triggerNodeMicroAnim(nodeEl, animClass) {
        if (!nodeEl) return;
        const animWrap = nodeEl.querySelector(".scatter-anim-wrap");
        if (!animWrap) return;
        nodeEl.classList.add("is-animating");
        animWrap.classList.remove("anim-pixel-spin", "anim-pixel-pop", "anim-pixel-wiggle");
        void animWrap.offsetWidth;
        animWrap.classList.add(animClass);
        setTimeout(() => {
            nodeEl.classList.remove("is-animating");
            animWrap.classList.remove("anim-pixel-spin", "anim-pixel-pop", "anim-pixel-wiggle");
        }, 900);
    }

    function renderWelcomeScatter() {
        welcomeScatterField.innerHTML = "";
        if (selectedScribbles.length === 0) return;

        const activeIcons = selectedScribbles
            .map(id => SCRIBBLE_ICONS.find(ic => ic.id === id))
            .filter(Boolean);
        if (activeIcons.length === 0) return;

        const modeOffset = welcomeActionMode === "go" ? 7919 : 0;
        const todaySeed = parseInt(getTodayStr().replace(/-/g, ""), 10) + selectedScribbles.join("").length * 131 + modeOffset;
        const rng = createSeededRng(todaySeed);

        const sizeNorm = scribbleSizePct / 100;
        const scaleFactor = 0.58 + Math.pow(sizeNorm, 1.15) * 1.78;
        const basePx = Math.round(54 * scaleFactor);
        const minDistPct = Math.max(7.2, 6.2 + sizeNorm * 7.5);
        const targetCount = Math.max(10, Math.round(32 - sizeNorm * 16));

        const placed = [];
        let attempts = 0;

        while (placed.length < targetCount && attempts < 700) {
            attempts++;
            const x = 6 + rng() * 88;
            const y = 5 + rng() * 90;

            const inGreetingZone = (y > 7 && y < 22 && x > 14 && x < 86);
            if (inGreetingZone) continue;

            let tooClose = false;
            for (const pt of placed) {
                const dx = (pt.x - x) * 0.65;
                const dy = (pt.y - y);
                if (Math.hypot(dx, dy) < minDistPct) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;
            placed.push({ x, y });
        }

        placed.forEach((pt, idx) => {
            const iconObj = activeIcons[idx % activeIcons.length];
            const rotDeg = Math.round((rng() - 0.5) * 90);
            const sizeJitter = 0.55 + rng() * 0.95;
            const finalPx = Math.round(basePx * sizeJitter);
            const alpha = (0.25 + rng() * 0.25).toFixed(2);

            const node = document.createElement("div");
            node.className = "scatter-node";
            node.style.left = `${pt.x.toFixed(1)}%`;
            node.style.top = `${pt.y.toFixed(1)}%`;
            node.style.setProperty("--base-rot", `${rotDeg}deg`);
            node.style.setProperty("--icon-size", `${finalPx}px`);
            node.style.setProperty("--icon-alpha", alpha);

            node.innerHTML = `<div class="scatter-rot-wrap"><div class="scatter-anim-wrap">${makeScribbleSvg(iconObj)}</div></div>`;

            node.addEventListener("click", (e) => {
                e.stopPropagation();
                const anims = ["anim-pixel-spin", "anim-pixel-pop", "anim-pixel-wiggle"];
                triggerNodeMicroAnim(node, anims[Math.floor(Math.random() * anims.length)]);
            });

            welcomeScatterField.appendChild(node);

            if (idx % 4 === 0) {
                setTimeout(() => triggerNodeMicroAnim(node, "anim-pixel-spin"), 160 + idx * 75);
            }
        });
    }

    function startAmbientPixelAnimations() {
        stopAmbientPixelAnimations();
        ambientAnimTimer = setInterval(() => {
            if (!welcomeOverlay.classList.contains("active")) return;
            const nodes = welcomeScatterField.querySelectorAll(".scatter-node");
            if (nodes.length === 0) return;
            const rndNode = nodes[Math.floor(Math.random() * nodes.length)];
            const anims = ["anim-pixel-spin", "anim-pixel-spin", "anim-pixel-pop", "anim-pixel-wiggle"];
            triggerNodeMicroAnim(rndNode, anims[Math.floor(Math.random() * anims.length)]);
        }, 2200);
    }

    function stopAmbientPixelAnimations() {
        if (ambientAnimTimer) {
            clearInterval(ambientAnimTimer);
            ambientAnimTimer = null;
        }
    }

    function updateWelcomeGreetingText() {
        const now = new Date();
        const hr = now.getHours();
        const cleanName = (userName || "").trim();

        if (welcomeActionMode === "go") {
            const salutation = hr >= 16 ? "Schönen Feierabend" : "Bis später";
            welcomeGreetingEl.textContent = cleanName ? `${salutation}, ${cleanName}!` : `${salutation}!`;
        } else {
            let salutation = "Guten Tag";
            if (hr < 11) salutation = "Guten Morgen";
            else if (hr >= 18) salutation = "Guten Abend";
            welcomeGreetingEl.textContent = cleanName ? `${salutation}, ${cleanName}!` : `${salutation}!`;
        }

        const dayName = weekdaysFull[now.getDay()];
        welcomeDateSubEl.textContent = `${dayName}, ${format2(now.getDate())}.${format2(now.getMonth() + 1)}.${now.getFullYear()}`;
    }

    function openWelcomeScreen(mode = "come") {
        const newMode = mode === "go" ? "go" : "come";
        const wasAlreadyOpen = welcomeOverlay.classList.contains("active");
        welcomeActionMode = newMode;

        if (welcomeActionMode === "go") {
            btnWelcomeAction.classList.add("mode-go");
            btnWelcomeMenu.classList.add("mode-go");
            welcomeActionTitle.textContent = "Gehen";
            welcomeActionSub.textContent = "Jetzt direkt ausstempeln";
        } else {
            btnWelcomeAction.classList.remove("mode-go");
            btnWelcomeMenu.classList.remove("mode-go");
            welcomeActionTitle.textContent = "Kommen";
            welcomeActionSub.textContent = "Jetzt direkt einstempeln";
        }

        if (metaThemeColor) metaThemeColor.setAttribute("content", window.hslToHex(appHue, 44, 22));

        updateWelcomeGreetingText();
        renderWelcomeScatter();

        if (wasAlreadyOpen) {
            welcomeOverlay.classList.remove("welcome-mode-switch");
            void welcomeOverlay.offsetWidth;
            welcomeOverlay.classList.add("welcome-mode-switch");
        } else {
            welcomeOverlay.classList.add("active");
            startAmbientPixelAnimations();
        }
        updateWelcomeWidgets();
    }

    function closeWelcomeScreen() {
        stopAmbientPixelAnimations();
        welcomeOverlay.classList.remove("active", "welcome-mode-switch");
        if (welcomeSollWidget) welcomeSollWidget.style.display = "none";
        if (welcomePauseWidget) welcomePauseWidget.style.display = "none";
        localStorage.setItem("welcomeDismissedDate", getTodayStr());
        applyThemeColors(appHue, appLightness);
    }

    /* =========================================================
       SCREEN 2 (UHR) <-> SCREEN 3 (WOCHE) NAVIGATION
       ========================================================= */
    const viewsStage = document.getElementById("views-stage");
    const viewClock = document.getElementById("view-clock");
    const viewWeek = document.getElementById("view-week");
    const toggleViewBtn = document.getElementById("btn-toggle-view");
    const iconViewWeek = document.getElementById("icon-view-week");
    const iconViewClock = document.getElementById("icon-view-clock");
    const weekDatePicker = document.getElementById("week-date-picker");
    let weekOffset = 0;

    function switchToClockView() {
        if (viewClock.classList.contains("active")) return;
        viewWeek.classList.remove("active");
        viewClock.classList.add("active");
        viewsStage.scrollTop = 0;
        iconViewWeek.style.display = "block";
        iconViewClock.style.display = "none";
        toggleViewBtn.title = "Woche";
        calculateAllTimes();
    }

    function switchToWeekView() {
        if (welcomeOverlay.classList.contains("active")) {
            closeWelcomeScreen();
        }
        closeCustomKeypad();
        if (viewWeek.classList.contains("active")) return;
        viewClock.classList.remove("active");
        viewWeek.classList.add("active");
        viewsStage.scrollTop = 0;
        iconViewWeek.style.display = "none";
        iconViewClock.style.display = "block";
        toggleViewBtn.title = "Uhr";
        weekOffset = 0;
        buildWeekView();
    }

    toggleViewBtn.addEventListener("click", () => {
        if (viewClock.classList.contains("active")) switchToWeekView();
        else switchToClockView();
    });

    function changeWeek(delta) {
        weekOffset += delta;
        buildWeekView();
    }

    function jumpToCurrentWeek() {
        if (weekOffset === 0) return;
        weekOffset = 0;
        buildWeekView();
    }

    function jumpToDateStr(dateStr) {
        if (!dateStr) return;
        const parts = dateStr.split("-").map(Number);
        const targetDate = new Date(parts[0], parts[1] - 1, parts[2]);
        const todayMonday = getMonday(new Date());
        const targetMonday = getMonday(targetDate);
        todayMonday.setHours(12, 0, 0, 0);
        targetMonday.setHours(12, 0, 0, 0);
        weekOffset = Math.round((targetMonday - todayMonday) / (7 * 86400000));
        buildWeekView();
    }

    document.getElementById("btn-prev-week").addEventListener("click", (e) => {
        e.stopPropagation();
        changeWeek(-1);
    });
    document.getElementById("btn-next-week").addEventListener("click", (e) => {
        e.stopPropagation();
        changeWeek(1);
    });
    document.getElementById("week-kw-badge").addEventListener("click", (e) => {
        e.stopPropagation();
        jumpToCurrentWeek();
    });
    weekDatePicker.addEventListener("change", () => jumpToDateStr(weekDatePicker.value));

    const kwMergedSwipebar = document.getElementById("kw-merged-swipebar");
    let kwBarStartX = 0, kwBarDidSwipe = false;
    kwMergedSwipebar.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
            kwBarStartX = e.touches[0].clientX;
            kwBarDidSwipe = false;
        }
    }, { passive: true });
    kwMergedSwipebar.addEventListener("touchmove", (e) => {
        if (e.touches.length === 1 && Math.abs(e.touches[0].clientX - kwBarStartX) > 22) {
            kwBarDidSwipe = true;
        }
    }, { passive: true });
    kwMergedSwipebar.addEventListener("touchend", (e) => {
        if (e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - kwBarStartX;
        if (Math.abs(dx) > 36) {
            e.preventDefault();
            e.stopPropagation();
            changeWeek(dx < 0 ? 1 : -1);
        }
    });
    kwMergedSwipebar.addEventListener("click", (e) => {
        if (kwBarDidSwipe) {
            e.preventDefault();
            e.stopPropagation();
            kwBarDidSwipe = false;
        }
    }, true);

    /* =========================================================
       SCREEN 4: MENÜ (EINSTELLUNGEN & UNTERMENÜS)
       ========================================================= */
    const userNameInput = document.getElementById("userNameInput");
    const sollHoursInput = document.getElementById("sollHours");
    const sollMinutesInput = document.getElementById("sollMinutes");
    const weeklyHoursInput = document.getElementById("weeklyHoursInput");
    const glzBaseInput = document.getElementById("glzBaseInput");
    const glzBaseDateInput = document.getElementById("glzBaseDateInput");
    const pauseNotifyCheck = document.getElementById("pauseNotifyCheck");
    const pauseNotifyLeadInput = document.getElementById("pauseNotifyLeadInput");
    const pauseNotifyMinsWrap = document.getElementById("pauseNotifyMinsWrap");

    const sollWidgetEnabledCheck = document.getElementById("sollWidgetEnabledCheck");
    const sollWidgetOptionsWrap = document.getElementById("soll-widget-options-wrap");
    const sollWidgetModePills = document.getElementById("soll-widget-mode-pills");

    const pauseWatcherEnabledCheck = document.getElementById("pauseWatcherEnabledCheck");
    const pauseWatcherOptionsWrap = document.getElementById("pause-watcher-options-wrap");
    const pauseWatcherModePills = document.getElementById("pause-watcher-mode-pills");

    const keyboardModePills = document.getElementById("keyboard-mode-pills");

    const styleModeSelect = document.getElementById("styleModeSelect");
    const asymSliderWrap = document.getElementById("asymSliderWrap");
    const asymIntensitySlider = document.getElementById("asymIntensitySlider");
    const asymIntensityVal = document.getElementById("asymIntensityVal");

    const isSmokerCheck = document.getElementById("isSmokerCheck");
    const smokeMinutesInput = document.getElementById("smokeMinutesInput");
    const smokerMinsWrap = document.getElementById("smokerMinsWrap");
    const smokeBar = document.getElementById("smoke-bar");
    const smokeCountDisplay = document.getElementById("smoke-count-display");
    const gesturesEnabledCheck = document.getElementById("gesturesEnabledCheck");
    const lightnessSlider = document.getElementById("lightnessSlider");
    const lightnessVal = document.getElementById("lightnessVal");

    userNameInput.value = userName;
    sollHoursInput.value = sollHours;
    sollMinutesInput.value = sollMinutes;
    weeklyHoursInput.value = String(weeklyHours).replace(".", ",");
    glzBaseInput.value = String(glzBaseHours).replace(".", ",");
    glzBaseDateInput.value = glzBaseDate;
    pauseNotifyCheck.checked = pauseNotifyEnabled;
    pauseNotifyLeadInput.value = pauseNotifyLeadMins;
    sollWidgetEnabledCheck.checked = sollWidgetEnabled;
    pauseWatcherEnabledCheck.checked = pauseWatcherEnabled;
    styleModeSelect.value = appStyleMode;
    asymIntensitySlider.value = appAsymIntensity;
    asymIntensityVal.textContent = appAsymIntensity;
    isSmokerCheck.checked = isSmoker;
    smokeMinutesInput.value = smokeMinutesPerBreak;
    gesturesEnabledCheck.checked = gesturesEnabled;
    lightnessSlider.value = appLightness;
    lightnessVal.textContent = appLightness;
    scribbleSizeSlider.value = scribbleSizePct;
    scribbleSizeVal.textContent = scribbleSizePct;

    function syncSollWidgetSettingsUI() {
        sollWidgetOptionsWrap.style.opacity = sollWidgetEnabled ? "1" : "0.45";
        sollWidgetOptionsWrap.style.pointerEvents = sollWidgetEnabled ? "auto" : "none";
        sollWidgetModePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
            const isSel = pill.getAttribute("data-sw-mode") === sollWidgetMode;
            pill.classList.toggle("selected", isSel);
            pill.setAttribute("aria-checked", isSel ? "true" : "false");
        });
    }

    function syncPauseWatcherSettingsUI() {
        pauseWatcherOptionsWrap.style.opacity = pauseWatcherEnabled ? "1" : "0.45";
        pauseWatcherOptionsWrap.style.pointerEvents = pauseWatcherEnabled ? "auto" : "none";
        pauseWatcherModePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
            const isSel = pill.getAttribute("data-pw-mode") === pauseWatcherMode;
            pill.classList.toggle("selected", isSel);
            pill.setAttribute("aria-checked", isSel ? "true" : "false");
        });
    }

    function syncKeyboardModeUI() {
        keyboardModePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
            const isSel = pill.getAttribute("data-kb-mode") === keyboardMode;
            pill.classList.toggle("selected", isSel);
            pill.setAttribute("aria-checked", isSel ? "true" : "false");
        });
    }

    syncSollWidgetSettingsUI();
    syncPauseWatcherSettingsUI();
    syncKeyboardModeUI();

    sollWidgetEnabledCheck.addEventListener("change", () => {
        sollWidgetEnabled = sollWidgetEnabledCheck.checked;
        syncSollWidgetSettingsUI();
    });

    sollWidgetModePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            sollWidgetMode = pill.getAttribute("data-sw-mode") || "both";
            syncSollWidgetSettingsUI();
        });
    });

    pauseWatcherEnabledCheck.addEventListener("change", () => {
        pauseWatcherEnabled = pauseWatcherEnabledCheck.checked;
        syncPauseWatcherSettingsUI();
    });

    pauseWatcherModePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            pauseWatcherMode = pill.getAttribute("data-pw-mode") || "both";
            syncPauseWatcherSettingsUI();
        });
    });

    keyboardModePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            keyboardMode = pill.getAttribute("data-kb-mode") === "system" ? "system" : "app";
            syncKeyboardModeUI();
            applyKeyboardModeToInputs();
            updateSettingsNavPreviews();
        });
    });

    function syncStyleControlsUI() {
        asymSliderWrap.style.display = styleModeSelect.value === "asymmetric" ? "block" : "none";
    }
    syncStyleControlsUI();

    styleModeSelect.addEventListener("change", () => {
        appStyleMode = styleModeSelect.value;
        document.documentElement.setAttribute("data-style", appStyleMode);
        syncStyleControlsUI();
    });

    asymIntensitySlider.addEventListener("input", () => {
        appAsymIntensity = applyAsymIntensity(asymIntensitySlider.value);
        asymIntensityVal.textContent = appAsymIntensity;
    });

    function updatePauseNotifyUI() {
        pauseNotifyMinsWrap.style.opacity = pauseNotifyCheck.checked ? "1" : "0.45";
        pauseNotifyLeadInput.disabled = !pauseNotifyCheck.checked;
    }
    updatePauseNotifyUI();

    pauseNotifyCheck.addEventListener("change", async () => {
        if (pauseNotifyCheck.checked) {
            if (!("Notification" in window)) {
                alert("Dieser Browser unterstützt leider keine System-Benachrichtigungen.");
                pauseNotifyCheck.checked = false;
                updatePauseNotifyUI();
                return;
            }
            let perm = Notification.permission;
            if (perm === "default") {
                perm = await Notification.requestPermission();
            }
            if (perm !== "granted") {
                alert("Benachrichtigungen wurden im Browser blockiert. Bitte erlaube sie in den Website-Einstellungen.");
                pauseNotifyCheck.checked = false;
            } else {
                pauseNotifyEnabled = true;
                pauseNotifyLeadMins = Math.min(60, Math.max(1, parseInt(pauseNotifyLeadInput.value, 10) || 10));
                showAppNotification(
                    "Stempeluhr: Vorwarnung aktiv",
                    `Du wirst ${pauseNotifyLeadMins} Min vor der 30-Min- und 45-Min-Pausengrenze erinnert.`,
                    "pause-test"
                );
            }
        } else {
            pauseNotifyEnabled = false;
        }
        updatePauseNotifyUI();
    });

    function updateSmokerUI() {
        smokerMinsWrap.style.opacity = isSmokerCheck.checked ? "1" : "0.45";
        smokeMinutesInput.disabled = !isSmokerCheck.checked;
        smokeBar.style.display = isSmoker ? "grid" : "none";
        smokeCountDisplay.textContent = `${todaySmokeCount}× (-${todaySmokeCount * smokeMinutesPerBreak}m)`;
    }
    isSmokerCheck.addEventListener("change", () => {
        smokerMinsWrap.style.opacity = isSmokerCheck.checked ? "1" : "0.45";
        smokeMinutesInput.disabled = !isSmokerCheck.checked;
    });

    function saveTodaySmokeData() {
        const todayStr = getTodayStr();
        const currentDay = getDayData(todayStr) || { status: 'work', startH: '', startM: '', endH: '', endM: '' };
        currentDay.smokeCount = todaySmokeCount;
        currentDay.smokeTotalMins = todaySmokeCount * smokeMinutesPerBreak;
        saveDayData(todayStr, currentDay);
    }

    document.getElementById("btn-add-smoke").addEventListener("click", () => {
        pushUndoSnapshot();
        todaySmokeCount++;
        updateSmokerUI();
        saveTodaySmokeData();
        calculateAllTimes();
    });
    document.getElementById("btn-sub-smoke").addEventListener("click", () => {
        if (todaySmokeCount > 0) {
            pushUndoSnapshot();
            todaySmokeCount--;
            updateSmokerUI();
            saveTodaySmokeData();
            calculateAllTimes();
        }
    });

    updateSmokerUI();
    syncScribbleAccordionUI();
    updateSettingsNavPreviews();
    updateBackupStatusBadge();

    /* FARBRAD */
    const canvas = document.getElementById("colorWheel");
    const ctx = canvas.getContext("2d");
    const radius = canvas.width / 2;

    function drawWheelDot(hueAngle, dotRadius) {
        const rad = hueAngle * Math.PI / 180;
        const dotX = radius + Math.cos(rad) * (radius * 0.7);
        const dotY = radius + Math.sin(rad) * (radius * 0.7);
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.lineWidth = dotRadius >= 7 ? 2.5 : 2;
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.stroke();
    }

    function drawColorWheel() {
        for (let angle = 0; angle < 360; angle++) {
            ctx.beginPath();
            ctx.moveTo(radius, radius);
            ctx.arc(radius, radius, radius, (angle - 0.5) * Math.PI / 180, (angle + 1.5) * Math.PI / 180);
            ctx.closePath();
            ctx.fillStyle = `hsl(${angle}, 100%, ${appLightness}%)`;
            ctx.fill();
        }
        drawWheelDot(appHue + 120, 4.5);
        drawWheelDot(appHue + 150, 4.5);
        drawWheelDot(appHue, 8);
    }

    lightnessSlider.addEventListener("input", () => {
        appLightness = Math.min(52, Math.max(28, parseInt(lightnessSlider.value, 10)));
        lightnessVal.textContent = appLightness;
        applyThemeColors(appHue, appLightness);
        drawColorWheel();
    });

    function handleColorPick(e) {
        if (e.cancelable) e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const pt = (e.touches && e.touches.length > 0) ? e.touches[0] : e;
        const x = pt.clientX - rect.left - radius;
        const y = pt.clientY - rect.top - radius;
        let angle = Math.atan2(y, x) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        appHue = Math.round(angle);
        applyThemeColors(appHue, appLightness);
        drawColorWheel();
    }

    canvas.addEventListener("mousedown", (e) => {
        handleColorPick(e);
        canvas.addEventListener("mousemove", handleColorPick);
    });
    window.addEventListener("mouseup", () => canvas.removeEventListener("mousemove", handleColorPick));
    canvas.addEventListener("touchstart", (e) => {
        handleColorPick(e);
        canvas.addEventListener("touchmove", handleColorPick, { passive: false });
    }, { passive: false });
    window.addEventListener("touchend", () => canvas.removeEventListener("touchmove", handleColorPick));

    /* EINSTELLUNGS-PERSISTENZ */
    function persistAllSettings() {
        userName = userNameInput.value.trim();
        sollHours = Math.min(24, Math.max(0, parseInt(sollHoursInput.value, 10) || 0));
        sollMinutes = Math.min(59, Math.max(0, parseInt(sollMinutesInput.value, 10) || 0));
        sollHoursInput.value = sollHours;
        sollMinutesInput.value = sollMinutes;

        const parsedWeekly = parseFloat(String(weeklyHoursInput.value).replace(',', '.'));
        weeklyHours = (!isNaN(parsedWeekly) && parsedWeekly > 0 && parsedWeekly <= 48) ? parsedWeekly : 40;
        weeklyHoursInput.value = String(weeklyHours).replace('.', ',');

        const parsedGlzBase = parseFloat(String(glzBaseInput.value).replace(',', '.'));
        glzBaseHours = !isNaN(parsedGlzBase) ? parsedGlzBase : 0;
        glzBaseInput.value = String(glzBaseHours).replace('.', ',');

        glzBaseDate = glzBaseDateInput.value || "";

        pauseNotifyEnabled = pauseNotifyCheck.checked && ("Notification" in window) && Notification.permission === "granted";
        pauseNotifyLeadMins = Math.min(60, Math.max(1, parseInt(pauseNotifyLeadInput.value, 10) || 10));
        pauseNotifyLeadInput.value = pauseNotifyLeadMins;

        sollWidgetEnabled = sollWidgetEnabledCheck.checked;
        pauseWatcherEnabled = pauseWatcherEnabledCheck.checked;

        appStyleMode = styleModeSelect.value;
        appAsymIntensity = applyAsymIntensity(asymIntensitySlider.value);
        document.documentElement.setAttribute("data-style", appStyleMode);

        isSmoker = isSmokerCheck.checked;
        smokeMinutesPerBreak = Math.min(60, Math.max(1, parseInt(smokeMinutesInput.value, 10) || 5));
        smokeMinutesInput.value = smokeMinutesPerBreak;

        gesturesEnabled = gesturesEnabledCheck.checked;

        localStorage.setItem("userName", userName);
        localStorage.setItem("selectedScribbles", JSON.stringify(selectedScribbles));
        localStorage.setItem("scribbleSizePct", scribbleSizePct);
        localStorage.setItem("appStyleMode", appStyleMode);
        localStorage.setItem("appAsymIntensity", appAsymIntensity);
        localStorage.setItem("appIconTheme", appIconTheme);
        localStorage.setItem("sollHours", sollHours);
        localStorage.setItem("sollMinutes", sollMinutes);
        localStorage.setItem("weeklyHours", weeklyHours);
        localStorage.setItem("glzBaseHours", glzBaseHours);
        localStorage.setItem("glzBaseDate", glzBaseDate);
        localStorage.setItem("pauseNotifyEnabled", pauseNotifyEnabled);
        localStorage.setItem("pauseNotifyLeadMins", pauseNotifyLeadMins);
        localStorage.setItem("sollWidgetEnabled", sollWidgetEnabled);
        localStorage.setItem("sollWidgetMode", sollWidgetMode);
        localStorage.setItem("pauseWatcherEnabled", pauseWatcherEnabled);
        localStorage.setItem("pauseWatcherMode", pauseWatcherMode);
        localStorage.setItem("keyboardMode", keyboardMode);
        localStorage.setItem("isSmoker", isSmoker);
        localStorage.setItem("smokeMinutesPerBreak", smokeMinutesPerBreak);
        localStorage.setItem("gesturesEnabled", gesturesEnabled);
        localStorage.setItem("appHue", appHue);
        localStorage.setItem("appLightness", appLightness);

        if (window.applyAppIconTheme) window.applyAppIconTheme(appIconTheme);
        applyThemeColors(appHue, appLightness);
        applyKeyboardModeToInputs();
        if (isSmoker) saveTodaySmokeData();
        updateSmokerUI();
        syncScribbleAccordionUI();
        updateSettingsNavPreviews();
        calculateAllTimes();
        checkPauseNotifications();
        updateWelcomeWidgets();
        if (viewWeek.classList.contains("active")) buildWeekView();
        else updateAmpelPill();
    }

    const settingsModal = document.getElementById("settings-modal");
    const settingsPageMain = document.getElementById("settings-page-main");
    const settingsPageWork = document.getElementById("settings-page-work");
    const settingsPageWidgets = document.getElementById("settings-page-widgets");
    const settingsPageDesign = document.getElementById("settings-page-design");

    function showSettingsSubpage(pageName) {
        closeCustomKeypad();
        settingsPageMain.style.display = pageName === "main" ? "block" : "none";
        settingsPageWork.style.display = pageName === "work" ? "block" : "none";
        settingsPageWidgets.style.display = pageName === "widgets" ? "block" : "none";
        settingsPageDesign.style.display = pageName === "design" ? "block" : "none";

        if (pageName === "design") {
            scribbleAccordionOpen = false;
            renderScribblePicker();
            syncIconThemePickerUI();
            drawColorWheel();
        } else if (pageName === "widgets") {
            sollWidgetEnabledCheck.checked = sollWidgetEnabled;
            pauseWatcherEnabledCheck.checked = pauseWatcherEnabled;
            syncSollWidgetSettingsUI();
            syncPauseWatcherSettingsUI();
            syncKeyboardModeUI();
        } else if (pageName === "main") {
            updateSettingsNavPreviews();
            updateBackupStatusBadge();
        }
    }

    function leaveSubpageAndSave() {
        closeCustomKeypad();
        persistAllSettings();
        showSettingsSubpage("main");
    }

    function openSettingsMenu() {
        if (welcomeOverlay.classList.contains("active")) {
            closeWelcomeScreen();
        }
        closeCustomKeypad();
        userNameInput.value = userName;
        weeklyHoursInput.value = String(weeklyHours).replace('.', ',');
        glzBaseInput.value = String(glzBaseHours).replace('.', ',');
        glzBaseDateInput.value = glzBaseDate;
        pauseNotifyCheck.checked = pauseNotifyEnabled;
        pauseNotifyLeadInput.value = pauseNotifyLeadMins;
        sollWidgetEnabledCheck.checked = sollWidgetEnabled;
        pauseWatcherEnabledCheck.checked = pauseWatcherEnabled;
        syncSollWidgetSettingsUI();
        syncPauseWatcherSettingsUI();
        syncKeyboardModeUI();
        updatePauseNotifyUI();
        syncStyleControlsUI();
        syncIconThemePickerUI();
        updateBackupStatusBadge();
        showSettingsSubpage("main");
        settingsModal.classList.add("active");
    }

    document.getElementById("btn-settings").addEventListener("click", openSettingsMenu);

    document.getElementById("btn-open-work-subpage").addEventListener("click", () => showSettingsSubpage("work"));
    document.getElementById("btn-open-widgets-subpage").addEventListener("click", () => showSettingsSubpage("widgets"));
    document.getElementById("btn-open-design-subpage").addEventListener("click", () => showSettingsSubpage("design"));
    document.getElementById("btn-back-from-work").addEventListener("click", leaveSubpageAndSave);
    document.getElementById("btn-done-work").addEventListener("click", leaveSubpageAndSave);
    document.getElementById("btn-back-from-widgets").addEventListener("click", leaveSubpageAndSave);
    document.getElementById("btn-done-widgets").addEventListener("click", leaveSubpageAndSave);
    document.getElementById("btn-back-from-design").addEventListener("click", leaveSubpageAndSave);
    document.getElementById("btn-done-design").addEventListener("click", leaveSubpageAndSave);

    function closeSettings() {
        closeCustomKeypad();
        persistAllSettings();
        settingsModal.classList.remove("active");
    }
    document.getElementById("btn-close-settings").addEventListener("click", closeSettings);
    document.getElementById("btn-save-settings").addEventListener("click", closeSettings);

    document.getElementById("btn-force-update").addEventListener("click", async () => {
        const btn = document.getElementById("btn-force-update");
        btn.textContent = "Suche...";
        btn.disabled = true;
        await forceAppReload();
    });

    /* =========================================================
       GLOBALE ZAHLENTASTATUR-ENGINE (APP- & SYSTEM-TASTATUR)
       ========================================================= */
    const startTimePill = document.getElementById("startTimePill");
    const endTimePill = document.getElementById("endTimePill");
    const pillStartWrap = document.getElementById("pill-start");
    const pillEndWrap = document.getElementById("pill-end");
    const keypadSheet = document.getElementById("custom-keypad-sheet");
    const keypadTargetBadge = document.getElementById("keypad-target-badge");

    let kpState = null;
    let lastKeypadKeyTime = 0;
    let lastKeypadOpenTime = 0;
    const boundKeypadInputs = new Set();

    function applyKeyboardModeToInputs() {
        const useSystem = keyboardMode === "system";
        if (useSystem) closeCustomKeypad();
        boundKeypadInputs.forEach((el) => {
            if (!el) return;
            const opts = el._kpOpts || {};
            if (useSystem) {
                el.removeAttribute("readonly");
                el.readOnly = false;
                if (opts.mode === "hhmm") el.setAttribute("inputmode", "numeric");
                else if (opts.allowDecimal || opts.allowNegative) el.setAttribute("inputmode", "decimal");
                else el.setAttribute("inputmode", "numeric");
            } else {
                el.setAttribute("readonly", "readonly");
                el.readOnly = true;
                el.setAttribute("inputmode", "none");
            }
        });
    }

    function formatRawDigitsToHhMm(digits) {
        const clean = digits.replace(/\D/g, "").slice(0, 4);
        if (!clean) return "";
        if (clean.length === 1) return `0${clean}:00`;
        if (clean.length === 2) return `${format2(Math.min(23, parseInt(clean, 10)))}:00`;
        if (clean.length === 3) {
            const h = Math.min(23, parseInt(clean[0], 10));
            const m = Math.min(59, parseInt(clean.slice(1), 10));
            return `${format2(h)}:${format2(m)}`;
        }
        const h = Math.min(23, parseInt(clean.slice(0, 2), 10));
        const m = Math.min(59, parseInt(clean.slice(2, 4), 10));
        return `${format2(h)}:${format2(m)}`;
    }

    function parseHhMmString(str) {
        if (!str) return null;
        const trimmed = str.trim();
        const colonMatch = trimmed.match(/^(\d{1,2})\s*[:.,]\s*(\d{1,2})$/);
        if (colonMatch) {
            const h = Math.min(23, Math.max(0, parseInt(colonMatch[1], 10) || 0));
            const m = Math.min(59, Math.max(0, parseInt(colonMatch[2], 10) || 0));
            return { h: format2(h), m: format2(m) };
        }
        const digitsOnly = trimmed.replace(/\D/g, "");
        if (!digitsOnly) return null;
        const formatted = formatRawDigitsToHhMm(digitsOnly);
        const [hh, mm] = formatted.split(":");
        return { h: hh, m: mm };
    }

    function getParsedStart() {
        return startTimePill.value.trim() !== "" ? parseHhMmString(startTimePill.value) : null;
    }
    function getParsedEnd() {
        return endTimePill.value.trim() !== "" ? parseHhMmString(endTimePill.value) : null;
    }

    function clearAllKeypadHighlights() {
        pillStartWrap.classList.remove("is-active");
        pillEndWrap.classList.remove("is-active");
        document.querySelectorAll(".keypad-bound-input.kp-focused").forEach(el => el.classList.remove("kp-focused"));
        settingsModal.classList.remove("keypad-open-shift");
        if (typeof dayEditorModal !== "undefined") dayEditorModal.classList.remove("keypad-open-shift");
    }

    function openGlobalKeypad(config) {
        if (keyboardMode === "system") return;
        if (kpState && kpState.onCommit) {
            kpState.onCommit(kpState.el, true);
        }
        clearAllKeypadHighlights();

        lastKeypadOpenTime = Date.now();
        kpState = {
            el: config.el,
            mode: config.mode || "number",
            label: config.label || "Eingabe",
            min: config.min !== undefined ? config.min : null,
            max: config.max !== undefined ? config.max : null,
            allowDecimal: !!config.allowDecimal,
            allowNegative: !!config.allowNegative,
            step: config.step || 1,
            nextEl: config.nextEl || null,
            onCommit: config.onCommit || null,
            fresh: true,
            buffer: ""
        };

        if (kpState.mode === "hhmm") {
            const parsed = parseHhMmString(kpState.el.value);
            kpState.buffer = parsed ? `${parsed.h}${parsed.m}` : "";
        } else {
            kpState.buffer = (kpState.el.value || "").trim();
        }

        keypadTargetBadge.textContent = kpState.label;
        if (kpState.el === startTimePill) pillStartWrap.classList.add("is-active");
        else if (kpState.el === endTimePill) pillEndWrap.classList.add("is-active");
        else kpState.el.classList.add("kp-focused");

        if (settingsModal.classList.contains("active")) settingsModal.classList.add("keypad-open-shift");
        if (typeof dayEditorModal !== "undefined" && dayEditorModal.classList.contains("active")) dayEditorModal.classList.add("keypad-open-shift");

        keypadSheet.classList.add("active");
        setTimeout(() => {
            if (kpState && kpState.el && kpState.el.scrollIntoView) {
                kpState.el.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }, 40);
    }

    function closeCustomKeypad() {
        if (kpState) {
            const closingState = kpState;
            kpState = null;
            clearAllKeypadHighlights();
            keypadSheet.classList.remove("active");
            if (closingState.onCommit) closingState.onCommit(closingState.el, true);
        } else {
            clearAllKeypadHighlights();
            keypadSheet.classList.remove("active");
        }
    }

    function registerKeypadInput(el, opts, beforeOpen = null) {
        if (!el) return;
        el._kpOpts = opts;
        if (boundKeypadInputs.has(el)) {
            applyKeyboardModeToInputs();
            return;
        }
        boundKeypadInputs.add(el);

        let lastFire = 0;
        el.addEventListener("pointerdown", (e) => {
            if (keyboardMode === "system" || el.disabled) return;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            const now = Date.now();
            if (now - lastFire < 180) return;
            lastFire = now;
            if (beforeOpen) beforeOpen();
            openGlobalKeypad({ el, ...opts });
        });
        el.addEventListener("click", (e) => {
            if (keyboardMode === "system") return;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
        });
        el.addEventListener("input", () => {
            if (keyboardMode !== "system") return;
            if (opts.onCommit) opts.onCommit(el, false);
        });
        el.addEventListener("change", () => {
            if (keyboardMode !== "system") return;
            if (opts.onCommit) opts.onCommit(el, true);
        });
        el.addEventListener("blur", () => {
            if (keyboardMode !== "system") return;
            if (opts.onCommit) opts.onCommit(el, true);
        });

        applyKeyboardModeToInputs();
    }

    registerKeypadInput(startTimePill, {
        mode: "hhmm",
        label: "Kommen (hh:mm)",
        nextEl: endTimePill,
        onCommit: () => {
            onManualTimeInputChange();
            calculateAllTimes();
        }
    }, () => pushUndoSnapshot());

    registerKeypadInput(endTimePill, {
        mode: "hhmm",
        label: "Gehen (hh:mm)",
        onCommit: () => {
            onManualTimeInputChange();
            calculateAllTimes();
        }
    }, () => pushUndoSnapshot());

    registerKeypadInput(sollHoursInput, {
        mode: "number", label: "Soll-Stunden (0–24)", min: 0, max: 24, step: 1, nextEl: sollMinutesInput,
        onCommit: () => calculateAllTimes()
    });
    registerKeypadInput(sollMinutesInput, {
        mode: "number", label: "Soll-Minuten (0–59)", min: 0, max: 59, step: 5,
        onCommit: () => calculateAllTimes()
    });
    registerKeypadInput(pauseNotifyLeadInput, {
        mode: "number", label: "Vorwarnung (Minuten)", min: 1, max: 60, step: 5
    });
    registerKeypadInput(smokeMinutesInput, {
        mode: "number", label: "Minuten pro Raucherpause", min: 1, max: 60, step: 1,
        onCommit: () => calculateAllTimes()
    });
    registerKeypadInput(glzBaseInput, {
        mode: "number", label: "GLZ-Startsaldo (h)", min: -200, max: 300, step: 0.5, allowDecimal: true, allowNegative: true
    });
    registerKeypadInput(weeklyHoursInput, {
        mode: "number", label: "Wochenstunden (1–48)", min: 1, max: 48, step: 0.5, allowDecimal: true
    });

    document.getElementById("keypad-close-btn").addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeCustomKeypad();
    });

    function openNextBoundInput(nextTarget) {
        if (!nextTarget || nextTarget.disabled) return;
        if (keyboardMode === "system") {
            if (typeof nextTarget.focus === "function") nextTarget.focus();
            return;
        }
        if (nextTarget === startTimePill) {
            pushUndoSnapshot();
            openGlobalKeypad({
                el: startTimePill, mode: "hhmm", label: "Kommen (hh:mm)", nextEl: endTimePill,
                onCommit: () => { onManualTimeInputChange(); calculateAllTimes(); }
            });
        } else if (nextTarget === endTimePill) {
            pushUndoSnapshot();
            openGlobalKeypad({
                el: endTimePill, mode: "hhmm", label: "Gehen (hh:mm)",
                onCommit: () => { onManualTimeInputChange(); calculateAllTimes(); }
            });
        } else if (nextTarget._kpOpts) {
            openGlobalKeypad({ el: nextTarget, ...nextTarget._kpOpts });
        }
    }

    function handleKeypadPress(action) {
        if (!kpState || keyboardMode === "system") return;
        const st = kpState;
        const el = st.el;

        if (st.mode === "hhmm") {
            if (/^[0-9]$/.test(action)) {
                if (st.fresh || st.buffer.length >= 4) {
                    st.buffer = action;
                    st.fresh = false;
                } else {
                    st.buffer += action;
                }
                el.value = formatRawDigitsToHhMm(st.buffer);
                if (st.onCommit) st.onCommit(el, false);
            } else if (action === "del") {
                st.fresh = false;
                st.buffer = st.buffer.slice(0, -1);
                el.value = st.buffer ? formatRawDigitsToHhMm(st.buffer) : "";
                if (st.onCommit) st.onCommit(el, false);
            } else if (action === "-" || action === "+") {
                const delta = action === "-" ? -15 : 15;
                const parsed = parseHhMmString(el.value) || { h: "08", m: "00" };
                const total = Math.min(23 * 60 + 59, Math.max(0, (parseInt(parsed.h, 10) * 60) + parseInt(parsed.m, 10) + delta));
                const nh = format2(Math.floor(total / 60));
                const nm = format2(total % 60);
                st.buffer = `${nh}${nm}`;
                st.fresh = false;
                el.value = `${nh}:${nm}`;
                if (st.onCommit) st.onCommit(el, false);
            } else if (action === "," || action === ".") {
                return;
            } else if (action === "enter") {
                const nextTarget = st.nextEl;
                closeCustomKeypad();
                openNextBoundInput(nextTarget);
            }
            return;
        }

        if (st.mode === "twoDigit") {
            if (/^[0-9]$/.test(action)) {
                if (st.fresh || st.buffer.length >= 2) {
                    st.buffer = action;
                    st.fresh = false;
                } else {
                    st.buffer += action;
                }
                let num = parseInt(st.buffer, 10);
                if (!isNaN(num)) {
                    if (st.max !== null && num > st.max) num = st.max;
                    if (st.min !== null && num < st.min) num = st.min;
                    el.value = st.buffer.length === 2 ? format2(num) : String(num);
                }
                if (st.onCommit) st.onCommit(el, false);
                if (st.buffer.length === 2 && st.nextEl) {
                    const nextTarget = st.nextEl;
                    closeCustomKeypad();
                    openNextBoundInput(nextTarget);
                }
            } else if (action === "del") {
                st.fresh = false;
                st.buffer = st.buffer.slice(0, -1);
                el.value = st.buffer;
                if (st.onCommit) st.onCommit(el, false);
            } else if (action === "-" || action === "+") {
                const step = st.step || 1;
                let cur = parseInt(el.value, 10);
                if (isNaN(cur)) cur = 0;
                cur += (action === "-" ? -step : step);
                if (st.min !== null && cur < st.min) cur = st.min;
                if (st.max !== null && cur > st.max) cur = st.max;
                st.buffer = format2(cur);
                st.fresh = false;
                el.value = st.buffer;
                if (st.onCommit) st.onCommit(el, false);
            } else if (action === "," || action === ".") {
                return;
            } else if (action === "enter") {
                const nextTarget = st.nextEl;
                closeCustomKeypad();
                openNextBoundInput(nextTarget);
            }
            return;
        }

        /* STANDARD ZAHLEN / DEZIMAL (MENÜ) */
        if (/^[0-9]$/.test(action)) {
            if (st.fresh) {
                st.buffer = action;
                st.fresh = false;
            } else {
                st.buffer = (st.buffer === "0") ? action : st.buffer + action;
            }
            el.value = st.buffer;
            if (st.onCommit) st.onCommit(el, false);
        } else if (action === "," || action === ".") {
            if (!st.allowDecimal) return;
            if (st.fresh) {
                st.buffer = "0,";
                st.fresh = false;
            } else if (!st.buffer.includes(",") && !st.buffer.includes(".")) {
                st.buffer = (st.buffer === "" || st.buffer === "-") ? st.buffer + "0," : st.buffer + ",";
            }
            el.value = st.buffer;
            if (st.onCommit) st.onCommit(el, false);
        } else if (action === "del") {
            st.fresh = false;
            st.buffer = st.buffer.slice(0, -1);
            el.value = st.buffer;
            if (st.onCommit) st.onCommit(el, false);
        } else if (action === "-" || action === "+") {
            if (st.allowNegative && (st.fresh || st.buffer === "") && action === "-") {
                st.buffer = "-";
                st.fresh = false;
                el.value = st.buffer;
            } else {
                const rawVal = (st.buffer !== "" ? st.buffer : el.value) || "0";
                let num = parseFloat(String(rawVal).replace(",", "."));
                if (isNaN(num)) num = 0;
                const delta = action === "-" ? -st.step : st.step;
                num = Math.round((num + delta) * 100) / 100;
                if (!st.allowNegative && num < 0) num = 0;
                if (st.min !== null && num < st.min) num = st.min;
                if (st.max !== null && num > st.max) num = st.max;
                const formatted = String(num).replace(".", ",");
                st.buffer = formatted;
                st.fresh = false;
                el.value = formatted;
            }
            if (st.onCommit) st.onCommit(el, false);
        } else if (action === "enter") {
            const nextTarget = st.nextEl;
            closeCustomKeypad();
            openNextBoundInput(nextTarget);
        }
    }

    keypadSheet.querySelectorAll(".kp-key").forEach((keyBtn) => {
        keyBtn.addEventListener("pointerdown", (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            const now = Date.now();
            if (now - lastKeypadKeyTime < 75) return;
            lastKeypadKeyTime = now;
            const action = keyBtn.getAttribute("data-kp");
            if (action) handleKeypadPress(action);
        });
        keyBtn.addEventListener("click", (e) => {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
        });
    });

    document.addEventListener("pointerdown", (e) => {
        if (!keypadSheet.classList.contains("active")) return;
        if (Date.now() - lastKeypadOpenTime < 220) return;
        if (!e.target.closest("#custom-keypad-sheet")
            && !e.target.closest(".keypad-bound-input")
            && !e.target.closest("#pill-start")
            && !e.target.closest("#pill-end")) {
            closeCustomKeypad();
        }
    });

    const btnUndo = document.getElementById("btn-undo");
    const sessionsBox = document.getElementById("sessions-box");
    const sessionsList = document.getElementById("sessions-list");
    const sessionsPresSum = document.getElementById("sessions-pres-sum");
    const sessionsBreakInfo = document.getElementById("sessions-break-info");
    const sessionsGapSum = document.getElementById("sessions-gap-sum");

    let todaySessions = [];
    let undoStack = [];

    const updateUndoButtonState = () => { btnUndo.disabled = undoStack.length === 0; };
    function pushUndoSnapshot() {
        undoStack.push({ sessions: JSON.parse(JSON.stringify(todaySessions)), smokeCount: todaySmokeCount });
        if (undoStack.length > 20) undoStack.shift();
        updateUndoButtonState();
    }

    btnUndo.addEventListener("click", () => {
        if (undoStack.length === 0) return;
        const prev = undoStack.pop();
        todaySessions = prev.sessions || [];
        todaySmokeCount = typeof prev.smokeCount === "number" ? prev.smokeCount : 0;
        updateUndoButtonState();
        updateSmokerUI();
        saveTodaySmokeData();
        syncInputsFromSessions();
        saveSessionsAndDay();
        calculateAllTimes();
    });

    function timeObjToSecs(t) {
        if (!t || t.h === "" || isNaN(parseInt(t.h, 10))) return null;
        return (parseInt(t.h, 10) * 3600) + ((parseInt(t.m, 10) || 0) * 60) + (parseInt(t.s, 10) || 0);
    }
    const formatTimeObjWithSecs = (t) => (!t || t.h === "") ? "--:--" : `${format2(parseInt(t.h, 10))}:${format2(parseInt(t.m, 10) || 0)}:${format2(parseInt(t.s, 10) || 0)}`;
    function getNowSecsOfDay() {
        const now = new Date();
        return (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    }

    function getSessionMetricsFromList(sessionsArr, liveEndSecs = null) {
        let totalPresSecs = 0, totalGapSecs = 0;
        for (let i = 0; i < sessionsArr.length; i++) {
            const sSecs = timeObjToSecs(sessionsArr[i].start);
            let eSecs = timeObjToSecs(sessionsArr[i].end);
            if (eSecs === null && liveEndSecs !== null && i === sessionsArr.length - 1) eSecs = liveEndSecs;
            if (sSecs !== null && eSecs !== null && eSecs > sSecs) totalPresSecs += (eSecs - sSecs);
            if (i > 0) {
                const prevEndSecs = timeObjToSecs(sessionsArr[i - 1].end);
                if (prevEndSecs !== null && sSecs !== null && sSecs > prevEndSecs) totalGapSecs += (sSecs - prevEndSecs);
            }
        }
        return { totalPresSecs, totalGapSecs };
    }
    const getSessionMetrics = (liveEndSecs = null) => getSessionMetricsFromList(todaySessions, liveEndSecs);

    function checkPauseNotifications() {
        if (!pauseNotifyEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
        const parsedS = getParsedStart();
        const parsedE = getParsedEnd();
        if (!parsedS || parsedE) return;

        const stH = parseInt(parsedS.h, 10);
        const stM = parseInt(parsedS.m, 10) || 0;
        const stS = (todaySessions.length > 0 && todaySessions[0].start) ? (parseInt(todaySessions[0].start.s, 10) || 0) : 0;
        const startSecs = (stH * 3600) + (stM * 60) + stS;
        const nowSecs = getNowSecsOfDay();
        if (nowSecs <= startSecs) return;

        let totalPresSecs = nowSecs - startSecs;
        if (todaySessions.length > 1) {
            const metrics = getSessionMetrics(nowSecs);
            if (metrics.totalPresSecs > 0) totalPresSecs = metrics.totalPresSecs;
        }

        const todayStr = getTodayStr();
        const leadSecs = pauseNotifyLeadMins * 60;

        const limit30Secs = 23400;
        if (totalPresSecs >= (limit30Secs - leadSecs) && totalPresSecs < (limit30Secs + 180)) {
            const key30 = `notified_p30_${todayStr}`;
            if (!localStorage.getItem(key30)) {
                localStorage.setItem(key30, "1");
                const remMins = Math.max(0, Math.ceil((limit30Secs - totalPresSecs) / 60));
                const limit30Time = document.getElementById("output-30min-pause-range").textContent.split(" bis ")[0] || "";
                showAppNotification(
                    "Achtung: 30-Min-Pause droht!",
                    remMins > 0
                        ? `In ca. ${remMins} Min (ab ${limit30Time}) greift der automatische 30-Min-Pausenabzug.`
                        : `Die 6:30-Std-Grenze (${limit30Time}) ist erreicht – 30 Min Pause werden jetzt abgezogen.`,
                    "pause-30"
                );
            }
        }

        const limit45Secs = 35100;
        if (totalPresSecs >= (limit45Secs - leadSecs) && totalPresSecs < (limit45Secs + 180)) {
            const key45 = `notified_p45_${todayStr}`;
            if (!localStorage.getItem(key45)) {
                localStorage.setItem(key45, "1");
                const remMins = Math.max(0, Math.ceil((limit45Secs - totalPresSecs) / 60));
                const limit45Time = document.getElementById("output-45min-pause").textContent || "";
                showAppNotification(
                    "Achtung: 45-Min-Pause droht!",
                    remMins > 0
                        ? `In ca. ${remMins} Min (ab ${limit45Time}) greift der automatische 45-Min-Pausenabzug.`
                        : `Die 9:45-Std-Grenze (${limit45Time}) ist erreicht – 45 Min Pause werden jetzt abgezogen.`,
                    "pause-45"
                );
            }
        }
    }

    function renderSessionsBox() {
        if (todaySessions.length <= 1) {
            sessionsBox.style.display = "none";
            return;
        }
        sessionsBox.style.display = "block";
        sessionsList.innerHTML = "";

        const hasOpenLast = !todaySessions[todaySessions.length - 1].end;
        const { totalPresSecs, totalGapSecs } = getSessionMetrics(hasOpenLast ? getNowSecsOfDay() : null);
        sessionsPresSum.textContent = `Anwesenheit: ${format2(Math.floor(totalPresSecs / 3600))}:${format2(Math.floor((totalPresSecs % 3600) / 60))} h`;

        todaySessions.forEach((sess, idx) => {
            const row = document.createElement("div");
            row.className = "session-item";
            const endStr = sess.end ? formatTimeObjWithSecs(sess.end) : "läuft...";
            row.innerHTML = `<span><strong>#${idx + 1}:</strong> ${formatTimeObjWithSecs(sess.start)} – ${endStr}</span><button type="button" class="session-del-btn" data-idx="${idx}" title="Block entfernen">×</button>`;
            sessionsList.appendChild(row);
        });

        sessionsList.querySelectorAll(".session-del-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                pushUndoSnapshot();
                todaySessions.splice(parseInt(e.target.getAttribute("data-idx"), 10), 1);
                syncInputsFromSessions();
                saveSessionsAndDay();
                calculateAllTimes();
            });
        });

        if (totalGapSecs > 0) {
            sessionsBreakInfo.style.display = "flex";
            sessionsGapSum.textContent = `${Math.round(totalGapSecs / 60)} min`;
        } else {
            sessionsBreakInfo.style.display = "none";
        }
    }

    function syncInputsFromSessions() {
        if (todaySessions.length === 0) {
            startTimePill.value = "";
            endTimePill.value = "";
            return;
        }
        startTimePill.value = `${todaySessions[0].start.h}:${todaySessions[0].start.m || "00"}`;
        const last = todaySessions[todaySessions.length - 1];
        endTimePill.value = last.end ? `${last.end.h}:${last.end.m || "00"}` : "";
    }

    function saveSessionsAndDay() {
        const todayStr = getTodayStr();
        renderSessionsBox();

        if (todaySessions.length > 0) {
            localStorage.setItem("savedTodaySessions", JSON.stringify({ date: todayStr, sessions: todaySessions }));
        } else {
            localStorage.removeItem("savedTodaySessions");
        }

        const dow = new Date().getDay();
        if (todaySessions.length === 0 && todaySmokeCount === 0 && (dow === 0 || dow === 6)) {
            localStorage.removeItem("day_" + todayStr);
            return;
        }

        const pS = getParsedStart();
        const pE = getParsedEnd();
        const { totalPresSecs } = getSessionMetrics(null);
        let currentDay = getDayData(todayStr) || { status: 'work' };
        if (todaySessions.length > 0 && currentDay.status === 'free') currentDay.status = 'work';
        currentDay.startH = pS ? pS.h : '';
        currentDay.startM = pS ? pS.m : '';
        currentDay.endH = pE ? pE.h : '';
        currentDay.endM = pE ? pE.m : '';
        currentDay.sessions = todaySessions;
        currentDay.customPresSecs = totalPresSecs > 0 ? totalPresSecs : null;
        saveDayData(todayStr, currentDay);
    }

    function onManualTimeInputChange() {
        const pS = getParsedStart();
        const pE = getParsedEnd();
        if (!pS && !pE) {
            todaySessions = [];
            saveSessionsAndDay();
            return;
        }
        const startObj = pS ? { h: pS.h, m: pS.m, s: "00" } : null;
        const endObj = pE ? { h: pE.h, m: pE.m, s: "00" } : null;

        if (todaySessions.length === 0) {
            if (startObj) todaySessions.push({ start: startObj, end: endObj });
        } else {
            if (startObj) {
                const oldS = todaySessions[0].start;
                todaySessions[0].start = { ...startObj, s: (oldS && oldS.h === startObj.h && oldS.m === startObj.m) ? (oldS.s || "00") : "00" };
            }
            if (endObj) {
                const oldE = todaySessions[todaySessions.length - 1].end;
                todaySessions[todaySessions.length - 1].end = { ...endObj, s: (oldE && oldE.h === endObj.h && oldE.m === endObj.m) ? (oldE.s || "00") : "00" };
            } else {
                todaySessions[todaySessions.length - 1].end = null;
            }
        }
        saveSessionsAndDay();
    }

    function clampTwoDigitStr(valStr, min, max) {
        if (valStr === "") return "";
        let val = parseInt(valStr, 10);
        if (isNaN(val)) return "";
        if (!isNaN(min) && val < min) val = min;
        if (!isNaN(max) && val > max) val = max;
        return format2(val);
    }

    function triggerStampComeNow() {
        pushUndoSnapshot();
        const now = new Date();
        const tObj = { h: format2(now.getHours()), m: format2(now.getMinutes()), s: format2(now.getSeconds()) };
        if (todaySessions.length === 0) todaySessions.push({ start: tObj, end: null });
        else {
            const last = todaySessions[todaySessions.length - 1];
            if (last.end !== null) todaySessions.push({ start: tObj, end: null });
            else last.start = tObj;
        }
        if (!glzBaseDate) {
            glzBaseDate = getTodayStr();
            glzBaseDateInput.value = glzBaseDate;
            localStorage.setItem("glzBaseDate", glzBaseDate);
        }
        syncInputsFromSessions();
        saveSessionsAndDay();
        calculateAllTimes();
        checkPauseNotifications();
        updateWelcomeWidgets();
    }

    function triggerStampGoNow() {
        pushUndoSnapshot();
        const now = new Date();
        const tObj = { h: format2(now.getHours()), m: format2(now.getMinutes()), s: format2(now.getSeconds()) };
        if (todaySessions.length === 0) todaySessions.push({ start: { h: "00", m: "00", s: "00" }, end: tObj });
        else todaySessions[todaySessions.length - 1].end = tObj;
        syncInputsFromSessions();
        saveSessionsAndDay();
        calculateAllTimes();
        updateWelcomeWidgets();
    }

    document.getElementById("btn-now-start").addEventListener("click", triggerStampComeNow);
    document.getElementById("btn-now-end").addEventListener("click", triggerStampGoNow);
    btnWelcomeAction.addEventListener("click", () => {
        if (welcomeActionMode === "go") triggerStampGoNow();
        else triggerStampComeNow();
        closeWelcomeScreen();
    });
    btnWelcomeMenu.addEventListener("click", closeWelcomeScreen);

    const getTodaySmokeSecs = () => isSmoker ? todaySmokeCount * smokeMinutesPerBreak * 60 : 0;

    function getDeductionDetails(totalPresSecs, smokeSecs) {
        let legalPauseSecs = 0;
        if (totalPresSecs >= 35100) legalPauseSecs = 45 * 60;
        else if (totalPresSecs >= 23400) legalPauseSecs = 30 * 60;
        const totalDeductSecs = Math.max(legalPauseSecs, smokeSecs);
        return { netSecs: Math.max(0, totalPresSecs - totalDeductSecs), totalDeductSecs };
    }

    function calculateAllTimes() {
        calculateEndTimes();
        calculateWorkingTime();
        updateWelcomeWidgets();
    }

    function calculateEndTimes() {
        const pS = getParsedStart();
        if (!pS) {
            document.getElementById("output-no-pause").textContent = "-";
            document.getElementById("output-30min-pause-range").textContent = "-";
            document.getElementById("output-45min-pause").textContent = "-";
            return;
        }

        const hours = parseInt(pS.h, 10);
        const minutes = parseInt(pS.m, 10) || 0;
        const seconds = (todaySessions.length > 0 && todaySessions[0].start) ? (parseInt(todaySessions[0].start.s, 10) || 0) : 0;

        const { totalGapSecs } = getSessionMetrics(null);
        const startTime = new Date();
        startTime.setHours(hours, minutes, seconds, 0);

        const addS = (s) => new Date(startTime.getTime() + (s + totalGapSecs) * 1000);
        const formatT = (d) => `${format2(d.getHours())}:${format2(d.getMinutes())}:${format2(d.getSeconds())}`;

        document.getElementById("output-no-pause").textContent = formatT(addS(6 * 3600 + 29 * 60 + 59));
        document.getElementById("output-30min-pause-range").textContent = `${formatT(addS(6 * 3600 + 30 * 60))} bis ${formatT(addS(9 * 3600 + 44 * 60 + 59))}`;
        document.getElementById("output-45min-pause").textContent = formatT(addS(9 * 3600 + 45 * 60));
    }

    function calculateWorkingTime() {
        const pS = getParsedStart();
        const pE = getParsedEnd();

        const labelDec = document.getElementById("label-decimal-time");
        const labelOver = document.getElementById("label-overtime");
        const decOutputEl = document.getElementById("output-decimal-time");
        const pauseHintEl = document.getElementById("output-pause-hint");

        if (!pS) {
            labelDec.textContent = "Dezimal (h)";
            labelOver.textContent = "+/-";
            decOutputEl.textContent = "-";
            pauseHintEl.style.display = "none";
            document.getElementById("output-overtime").textContent = "-";
            return;
        }

        const stH = parseInt(pS.h, 10);
        const stM = parseInt(pS.m, 10) || 0;
        const isLiveRunning = !pE;

        const stS = (todaySessions.length > 0 && todaySessions[0].start) ? (parseInt(todaySessions[0].start.s, 10) || 0) : 0;
        const startSecs = (stH * 3600) + (stM * 60) + stS;

        let endSecs;
        if (isLiveRunning) {
            endSecs = getNowSecsOfDay();
            labelDec.innerHTML = `<span class="live-dot"></span>Bisher (Netto)`;
            labelOver.innerHTML = `<span class="live-dot"></span>Bis Soll (+/-)`;
        } else {
            const enH = parseInt(pE.h, 10);
            const enM = parseInt(pE.m, 10) || 0;
            const lastSess = todaySessions[todaySessions.length - 1];
            const enS = (lastSess && lastSess.end) ? (parseInt(lastSess.end.s, 10) || 0) : 0;
            endSecs = (enH * 3600) + (enM * 60) + enS;
            labelDec.textContent = "Dezimal (h)";
            labelOver.textContent = "+/-";
        }

        if (endSecs < startSecs) {
            decOutputEl.textContent = isLiveRunning ? "00:00 h" : "Ungültig";
            pauseHintEl.style.display = "none";
            document.getElementById("output-overtime").textContent = "-";
            return;
        }

        let totalPresSecs = endSecs - startSecs;
        if (todaySessions.length > 1) {
            const metrics = getSessionMetrics(isLiveRunning ? endSecs : null);
            if (metrics.totalPresSecs > 0) totalPresSecs = metrics.totalPresSecs;
        }

        const { netSecs, totalDeductSecs } = getDeductionDetails(totalPresSecs, getTodaySmokeSecs());
        const overSecs = netSecs - ((sollHours * 3600) + (sollMinutes * 60));

        const sign = overSecs < 0 ? "-" : "+";
        const aSecs = Math.abs(overSecs);
        document.getElementById("output-overtime").textContent = `${sign}${format2(Math.floor(aSecs / 3600))}:${format2(Math.floor((aSecs % 3600) / 60))}:${format2(aSecs % 60)}`;

        if (isLiveRunning) {
            decOutputEl.textContent = `${format2(Math.floor(netSecs / 3600))}:${format2(Math.floor((netSecs % 3600) / 60))} h`;
            if (totalDeductSecs > 0) {
                pauseHintEl.textContent = `inkl. -${Math.round(totalDeductSecs / 60)}m Pause`;
                pauseHintEl.style.display = "block";
            } else {
                pauseHintEl.style.display = "none";
            }
        } else {
            decOutputEl.textContent = (netSecs / 3600).toFixed(2);
            pauseHintEl.style.display = "none";
        }
    }

    /* =========================================================
       SCREEN 3: WOCHE, AMPELKONTO & PDF
       ========================================================= */
    function getMonday(d) {
        d = new Date(d);
        const day = d.getDay();
        return new Date(d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)));
    }

    function getDayBreakdown(saved, liveEndSecs = null) {
        if (!saved) return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };
        let totalPresSecs = 0, isLive = false;

        if (Array.isArray(saved.sessions) && saved.sessions.length > 0) {
            const hasOpenLast = !saved.sessions[saved.sessions.length - 1].end || saved.sessions[saved.sessions.length - 1].end.h === "";
            if (hasOpenLast && liveEndSecs !== null) {
                isLive = true;
                totalPresSecs = getSessionMetricsFromList(saved.sessions, liveEndSecs).totalPresSecs;
            } else if (saved.customPresSecs && saved.customPresSecs > 0) {
                totalPresSecs = saved.customPresSecs;
            } else {
                totalPresSecs = getSessionMetricsFromList(saved.sessions, null).totalPresSecs;
            }
        } else if (saved.customPresSecs && saved.customPresSecs > 0) {
            totalPresSecs = saved.customPresSecs;
        } else if (saved.startH !== '' && saved.startH !== undefined) {
            const sh = parseInt(saved.startH, 10), sm = parseInt(saved.startM, 10) || 0;
            if (isNaN(sh)) return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };
            const sSecs = sh * 3600 + sm * 60;
            if (saved.endH !== '' && saved.endH !== undefined) {
                const eh = parseInt(saved.endH, 10), em = parseInt(saved.endM, 10) || 0;
                if (isNaN(eh)) return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };
                const eSecs = eh * 3600 + em * 60;
                if (eSecs <= sSecs) return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };
                totalPresSecs = eSecs - sSecs;
            } else if (liveEndSecs !== null && liveEndSecs > sSecs) {
                isLive = true;
                totalPresSecs = liveEndSecs - sSecs;
            } else return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };
        } else return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };

        const { netSecs, totalDeductSecs } = getDeductionDetails(totalPresSecs, (saved.smokeTotalMins || 0) * 60);
        return { presSecs: totalPresSecs, deductSecs: totalDeductSecs, netSecs, isLive };
    }

    function computeTotalGlzHours() {
        const todayStr = getTodayStr();
        const nowSecs = getNowSecsOfDay();
        const sollSecsPerDay = (sollHours * 3600) + (sollMinutes * 60);
        let deltaSecs = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith("day_")) continue;
            const dateStr = key.slice(4);

            if (glzBaseDate && dateStr < glzBaseDate) continue;

            const parts = dateStr.split("-").map(Number);
            if (parts.length !== 3 || parts.some(isNaN)) continue;

            const dt = new Date(parts[0], parts[1] - 1, parts[2]);
            const dow = dt.getDay();
            const isWeekend = (dow === 0 || dow === 6);
            const saved = getDayData(dateStr);
            if (!saved) continue;

            const daySoll = isWeekend ? 0 : sollSecsPerDay;
            let dayCredited = 0;

            if (saved.status === "work") {
                const bd = getDayBreakdown(saved, dateStr === todayStr ? nowSecs : null);
                dayCredited = bd.netSecs;
                if (dayCredited === 0 && bd.presSecs === 0 && dateStr > todayStr) continue;
            } else if (saved.status === "vacation" || saved.status === "sick" || saved.status === "holiday") {
                dayCredited = daySoll;
            } else if (saved.status === "free") {
                dayCredited = 0;
            }

            deltaSecs += (dayCredited - daySoll);
        }

        return glzBaseHours + (deltaSecs / 3600);
    }

    function updateAmpelPill() {
        const pill = document.getElementById("glzPill");
        const pillText = document.getElementById("glzPillText");
        if (!pill || !pillText) return;

        const gesamtSaldo = computeTotalGlzHours();
        const faktor = (weeklyHours > 0 ? weeklyHours : 40) / 40;

        const gruenMin = -20 * faktor;
        const gruenMax =  40 * faktor;
        const gelbMin  = -40 * faktor;
        const gelbMax  =  80 * faktor;
        const rotMax   = 100 * faktor;

        pill.classList.remove("ampel-gruen", "ampel-gelb", "ampel-rot");

        const fmtSigned = (num) => (num >= 0 ? "+" : "") + num.toFixed(2).replace(".", ",");
        const fmtPlain = (num) => Math.abs(num).toFixed(1).replace(".", ",");

        let statusClass = "ampel-gruen";
        let infoText = "";

        if (gesamtSaldo >= gruenMin && gesamtSaldo <= gruenMax) {
            statusClass = "ampel-gruen";
            infoText = `Grün · noch ${fmtPlain(gruenMax - gesamtSaldo)}h bis Gelb`;
        } else if ((gesamtSaldo > gruenMax && gesamtSaldo <= gelbMax) || (gesamtSaldo < gruenMin && gesamtSaldo >= gelbMin)) {
            statusClass = "ampel-gelb";
            if (gesamtSaldo > gruenMax) {
                infoText = `Gelb · noch ${fmtPlain(gelbMax - gesamtSaldo)}h bis Rot`;
            } else {
                infoText = `Gelb (Minus) · noch ${fmtPlain(gesamtSaldo - gelbMin)}h Puffer`;
            }
        } else {
            statusClass = "ampel-rot";
            if (gesamtSaldo > rotMax) {
                infoText = `Rot (> ${rotMax.toFixed(0)}h Max!)`;
            } else if (gesamtSaldo < gelbMin) {
                infoText = `Rot (Minus-Grenze!)`;
            } else {
                infoText = `Rot · Rückführung nötig`;
            }
        }

        pill.classList.add(statusClass);
        pillText.textContent = `GLZ: ${fmtSigned(gesamtSaldo)}h (${infoText})`;
    }

    const statusLabels = { work: "Arbeit", vacation: "Urlaub", sick: "Krank", holiday: "Feiertag", free: "Frei" };
    const dayFullNames = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

    function openEditorForAnyDate(dateStr) {
        if (!dateStr) return;
        jumpToDateStr(dateStr);
        const parts = dateStr.split("-").map(Number);
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        const dowIdx = (dt.getDay() + 6) % 7;
        openDayEditor(dateStr, `${dayFullNames[dowIdx]}, ${format2(dt.getDate())}.${format2(dt.getMonth() + 1)}.${dt.getFullYear()}`, "work");
    }

    const backfillModal = document.getElementById("backfill-modal");
    const backfillDateInput = document.getElementById("backfillDateInput");
    let currentWeekSatStr = "", currentWeekSunStr = "";

    document.getElementById("btn-open-backfill-modal").addEventListener("click", () => {
        const refDate = new Date();
        refDate.setDate(refDate.getDate() + (weekOffset * 7));
        const monday = getMonday(refDate);

        const satDate = new Date(monday); satDate.setDate(monday.getDate() + 5);
        currentWeekSatStr = `${satDate.getFullYear()}-${format2(satDate.getMonth() + 1)}-${format2(satDate.getDate())}`;
        document.getElementById("quick-sat-date").textContent = `${format2(satDate.getDate())}.${format2(satDate.getMonth() + 1)}.${satDate.getFullYear()}`;

        const sunDate = new Date(monday); sunDate.setDate(monday.getDate() + 6);
        currentWeekSunStr = `${sunDate.getFullYear()}-${format2(sunDate.getMonth() + 1)}-${format2(sunDate.getDate())}`;
        document.getElementById("quick-sun-date").textContent = `${format2(sunDate.getDate())}.${format2(sunDate.getMonth() + 1)}.${sunDate.getFullYear()}`;

        backfillDateInput.value = currentWeekSatStr;
        backfillModal.classList.add("active");
    });

    document.getElementById("btn-close-backfill-modal").addEventListener("click", () => backfillModal.classList.remove("active"));
    document.getElementById("btn-quick-sat").addEventListener("click", () => { backfillModal.classList.remove("active"); openEditorForAnyDate(currentWeekSatStr); });
    document.getElementById("btn-quick-sun").addEventListener("click", () => { backfillModal.classList.remove("active"); openEditorForAnyDate(currentWeekSunStr); });
    document.getElementById("btn-confirm-backfill").addEventListener("click", () => {
        if (!backfillDateInput.value) return;
        const chosen = backfillDateInput.value;
        backfillModal.classList.remove("active");
        openEditorForAnyDate(chosen);
    });

    const dayEditorModal = document.getElementById("day-editor-modal");
    const dayEditorTitle = document.getElementById("day-editor-title");
    const dayEditorWorkArea = document.getElementById("day-editor-work-area");
    const dayEditorNonWorkNote = document.getElementById("day-editor-nonwork-note");
    const dayEditorBlocksList = document.getElementById("day-editor-blocks-list");
    const editorSmokeVal = document.getElementById("editor-smoke-val");
    let editingDateStr = null, editingDraft = null;

    function openDayEditor(dateStr, titleText, defaultStatus) {
        closeCustomKeypad();
        editingDateStr = dateStr;
        dayEditorTitle.textContent = titleText;
        const existing = getDayData(dateStr);
        if (existing) {
            editingDraft = JSON.parse(JSON.stringify(existing));
            if (editingDraft.status === "free" && !hasWeekendBooking(editingDraft)) editingDraft.status = "work";
        } else {
            editingDraft = { status: defaultStatus, startH: '', startM: '', endH: '', endM: '', sessions: [], smokeCount: 0 };
        }

        if (!editingDraft.sessions || editingDraft.sessions.length === 0) {
            if (editingDraft.startH !== '' && editingDraft.startH !== undefined) {
                editingDraft.sessions = [{
                    start: { h: format2(parseInt(editingDraft.startH, 10) || 0), m: format2(parseInt(editingDraft.startM, 10) || 0), s: '00' },
                    end: (editingDraft.endH !== '' && editingDraft.endH !== undefined)
                        ? { h: format2(parseInt(editingDraft.endH, 10) || 0), m: format2(parseInt(editingDraft.endM, 10) || 0), s: '00' } : null
                }];
            } else editingDraft.sessions = [];
        }
        if (typeof editingDraft.smokeCount !== 'number') editingDraft.smokeCount = 0;

        renderDayEditor();
        dayEditorModal.classList.add("active");
    }

    function closeDayEditor() {
        closeCustomKeypad();
        dayEditorModal.classList.remove("active");
        editingDateStr = null;
        editingDraft = null;
    }

    function renderDayEditor() {
        if (!editingDraft) return;
        document.querySelectorAll("#day-status-chips .day-status-chip").forEach(chip => {
            chip.classList.toggle("selected", chip.getAttribute("data-status") === editingDraft.status);
        });

        if (editingDraft.status !== "work") {
            dayEditorWorkArea.style.display = "none";
            dayEditorNonWorkNote.style.display = "block";
            return;
        }

        dayEditorWorkArea.style.display = "block";
        dayEditorNonWorkNote.style.display = "none";
        editorSmokeVal.textContent = `${editingDraft.smokeCount}×`;
        dayEditorBlocksList.innerHTML = "";

        if (editingDraft.sessions.length === 0) {
            editingDraft.sessions.push({ start: { h: "07", m: "30", s: "00" }, end: { h: "16", m: "00", s: "00" } });
        }

        editingDraft.sessions.forEach((blk, idx) => {
            const card = document.createElement("div");
            card.className = "editor-block-card";
            const sH = blk.start ? blk.start.h : "", sM = blk.start ? blk.start.m : "";
            const eH = blk.end ? blk.end.h : "", eM = blk.end ? blk.end.m : "";

            card.innerHTML = `
                <div class="editor-block-header">
                    <span>Zeitblock #${idx + 1}</span>
                    ${editingDraft.sessions.length > 1 ? `<button type="button" class="editor-block-del" data-del-idx="${idx}">Entfernen</button>` : ''}
                </div>
                <div class="editor-time-row">
                    <div class="editor-time-col">
                        <span class="lbl">Kommen</span>
                        <div class="editor-hhmm-pair">
                            <input type="text" inputmode="none" readonly class="ed-sh keypad-bound-input" value="${sH}" placeholder="hh">
                            <span>:</span>
                            <input type="text" inputmode="none" readonly class="ed-sm keypad-bound-input" value="${sM}" placeholder="mm">
                        </div>
                    </div>
                    <div class="editor-time-col">
                        <span class="lbl">Gehen</span>
                        <div class="editor-hhmm-pair">
                            <input type="text" inputmode="none" readonly class="ed-eh keypad-bound-input" value="${eH}" placeholder="hh">
                            <span>:</span>
                            <input type="text" inputmode="none" readonly class="ed-em keypad-bound-input" value="${eM}" placeholder="mm">
                        </div>
                    </div>
                </div>
            `;
            dayEditorBlocksList.appendChild(card);
        });

        dayEditorBlocksList.querySelectorAll("[data-del-idx]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                closeCustomKeypad();
                editingDraft.sessions.splice(parseInt(e.target.getAttribute("data-del-idx"), 10), 1);
                renderDayEditor();
            });
        });

        dayEditorBlocksList.querySelectorAll(".editor-block-card").forEach((card, idx) => {
            const shInp = card.querySelector(".ed-sh"), smInp = card.querySelector(".ed-sm");
            const ehInp = card.querySelector(".ed-eh"), emInp = card.querySelector(".ed-em");

            const syncEditorBlockFromInputs = (finalize) => {
                if (!editingDraft || !editingDraft.sessions[idx]) return;
                if (finalize) {
                    shInp.value = clampTwoDigitStr(shInp.value, 0, 23);
                    smInp.value = clampTwoDigitStr(smInp.value, 0, 59);
                    ehInp.value = clampTwoDigitStr(ehInp.value, 0, 23);
                    emInp.value = clampTwoDigitStr(emInp.value, 0, 59);
                }
                const blk = editingDraft.sessions[idx];
                if (shInp.value === "" && smInp.value === "") {
                    blk.start = null;
                } else {
                    const oldS = blk.start;
                    const nh = format2(Math.min(23, Math.max(0, parseInt(shInp.value, 10) || 0)));
                    const nm = format2(Math.min(59, Math.max(0, parseInt(smInp.value, 10) || 0)));
                    blk.start = { h: nh, m: nm, s: (oldS && oldS.h === nh && oldS.m === nm) ? (oldS.s || "00") : "00" };
                }
                if (ehInp.value === "" && emInp.value === "") {
                    blk.end = null;
                } else {
                    const oldE = blk.end;
                    const nh = format2(Math.min(23, Math.max(0, parseInt(ehInp.value, 10) || 0)));
                    const nm = format2(Math.min(59, Math.max(0, parseInt(emInp.value, 10) || 0)));
                    blk.end = { h: nh, m: nm, s: (oldE && oldE.h === nh && oldE.m === nm) ? (oldE.s || "00") : "00" };
                }
            };

            registerKeypadInput(shInp, {
                mode: "twoDigit", label: `#${idx + 1} Kommen · Stunde`, min: 0, max: 23, step: 1, nextEl: smInp,
                onCommit: (_, fin) => syncEditorBlockFromInputs(fin)
            });
            registerKeypadInput(smInp, {
                mode: "twoDigit", label: `#${idx + 1} Kommen · Minute`, min: 0, max: 59, step: 5, nextEl: ehInp,
                onCommit: (_, fin) => syncEditorBlockFromInputs(fin)
            });
            registerKeypadInput(ehInp, {
                mode: "twoDigit", label: `#${idx + 1} Gehen · Stunde`, min: 0, max: 23, step: 1, nextEl: emInp,
                onCommit: (_, fin) => syncEditorBlockFromInputs(fin)
            });
            registerKeypadInput(emInp, {
                mode: "twoDigit", label: `#${idx + 1} Gehen · Minute`, min: 0, max: 59, step: 5,
                onCommit: (_, fin) => syncEditorBlockFromInputs(fin)
            });
        });

        applyKeyboardModeToInputs();
    }

    document.querySelectorAll("#day-status-chips .day-status-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            if (!editingDraft) return;
            closeCustomKeypad();
            editingDraft.status = chip.getAttribute("data-status");
            renderDayEditor();
        });
    });
    document.getElementById("btn-editor-add-block").addEventListener("click", () => {
        if (!editingDraft) return;
        closeCustomKeypad();
        editingDraft.sessions.push({ start: { h: "12", m: "30", s: "00" }, end: { h: "16", m: "00", s: "00" } });
        renderDayEditor();
    });
    document.getElementById("btn-editor-smoke-plus").addEventListener("click", () => {
        if (!editingDraft) return;
        editingDraft.smokeCount = (editingDraft.smokeCount || 0) + 1;
        editorSmokeVal.textContent = `${editingDraft.smokeCount}×`;
    });
    document.getElementById("btn-editor-smoke-minus").addEventListener("click", () => {
        if (!editingDraft || (editingDraft.smokeCount || 0) <= 0) return;
        editingDraft.smokeCount--;
        editorSmokeVal.textContent = `${editingDraft.smokeCount}×`;
    });
    document.getElementById("btn-reset-day-editor").addEventListener("click", () => {
        if (!editingDateStr) return;
        const targetDate = editingDateStr;
        localStorage.removeItem("day_" + targetDate);
        if (targetDate === getTodayStr()) {
            pushUndoSnapshot();
            todaySessions = [];
            todaySmokeCount = 0;
            updateSmokerUI();
            syncInputsFromSessions();
            renderSessionsBox();
            localStorage.removeItem("savedTodaySessions");
            calculateAllTimes();
        }
        closeDayEditor();
        buildWeekView();
    });
    document.getElementById("btn-close-day-editor").addEventListener("click", closeDayEditor);

    document.getElementById("btn-save-day-editor").addEventListener("click", () => {
        closeCustomKeypad();
        if (!editingDateStr || !editingDraft) return;
        const validSessions = (editingDraft.sessions || []).filter(b => b.start && b.start.h !== "");
        editingDraft.sessions = validSessions;

        if (validSessions.length > 0) {
            editingDraft.startH = validSessions[0].start.h;
            editingDraft.startM = validSessions[0].start.m;
            const lastB = validSessions[validSessions.length - 1];
            editingDraft.endH = (lastB.end && lastB.end.h !== "") ? lastB.end.h : "";
            editingDraft.endM = (lastB.end && lastB.end.h !== "") ? lastB.end.m : "";
            const { totalPresSecs } = getSessionMetricsFromList(validSessions, null);
            editingDraft.customPresSecs = totalPresSecs > 0 ? totalPresSecs : null;
        } else {
            editingDraft.startH = ""; editingDraft.startM = "";
            editingDraft.endH = ""; editingDraft.endM = "";
            editingDraft.customPresSecs = null;
        }
        editingDraft.smokeTotalMins = (editingDraft.smokeCount || 0) * smokeMinutesPerBreak;

        const parts = editingDateStr.split("-").map(Number);
        const dow = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
        if ((dow === 0 || dow === 6) && !hasWeekendBooking(editingDraft)) localStorage.removeItem("day_" + editingDateStr);
        else saveDayData(editingDateStr, editingDraft);

        if (editingDateStr === getTodayStr()) {
            pushUndoSnapshot();
            todaySessions = JSON.parse(JSON.stringify(validSessions));
            todaySmokeCount = editingDraft.smokeCount || 0;
            updateSmokerUI();
            syncInputsFromSessions();
            renderSessionsBox();
            if (todaySessions.length > 0) localStorage.setItem("savedTodaySessions", JSON.stringify({ date: editingDateStr, sessions: todaySessions }));
            else localStorage.removeItem("savedTodaySessions");
            calculateAllTimes();
        }
        closeDayEditor();
        buildWeekView();
    });

    let weekStaticCreditedSecs = 0, weekTotalSollSecs = 0, weekHasLiveToday = false;

    function renderWeekSummaryLive() {
        const todayStr = getTodayStr(), nowSecs = getNowSecsOfDay();
        let liveTodaySecs = 0, isLiveNow = false;

        if (weekHasLiveToday) {
            const todaySaved = getDayData(todayStr);
            if (todaySaved && todaySaved.status === 'work') {
                const bd = getDayBreakdown(todaySaved, nowSecs);
                liveTodaySecs = bd.netSecs;
                isLiveNow = bd.isLive;
            }
        }

        const totalCreditedSecs = weekStaticCreditedSecs + liveTodaySecs;
        const diffSecs = totalCreditedSecs - weekTotalSollSecs;
        const sign = diffSecs < 0 ? "-" : "+";
        const absDiffSecs = Math.abs(diffSecs);

        const fmtHM = (s) => `${format2(Math.floor(Math.abs(s) / 3600))}:${format2(Math.floor((Math.abs(s) % 3600) / 60))} h`;
        const fmtHMS = (s) => {
            const a = Math.abs(s);
            return `${format2(Math.floor(a / 3600))}:${format2(Math.floor((a % 3600) / 60))}:${format2(a % 60)}`;
        };

        const lblWorked = document.getElementById("label-week-worked");
        const lblTotal = document.getElementById("label-week-total");

        if (isLiveNow) {
            lblWorked.innerHTML = `<span class="live-dot"></span>Geleistet (Live)`;
            lblTotal.innerHTML = `<span class="live-dot"></span>Wochen-Saldo`;
            document.getElementById("output-week-worked").textContent = fmtHMS(totalCreditedSecs);
            document.getElementById("output-week-total").textContent = `${sign}${fmtHMS(absDiffSecs)}`;
        } else {
            lblWorked.textContent = "Geleistet (Ist)";
            lblTotal.textContent = "Wochen-Saldo";
            document.getElementById("output-week-worked").textContent = fmtHM(totalCreditedSecs);
            document.getElementById("output-week-total").textContent = `${sign}${fmtHM(absDiffSecs)}`;
        }

        updateAmpelPill();
    }

    function buildWeekView() {
        const container = document.getElementById("week-days-container");
        container.innerHTML = "";

        const todayStr = getTodayStr();
        const refDate = new Date();
        refDate.setDate(refDate.getDate() + (weekOffset * 7));
        weekDatePicker.value = `${refDate.getFullYear()}-${format2(refDate.getMonth() + 1)}-${format2(refDate.getDate())}`;

        const kwNum = getCalendarWeek(refDate);
        document.getElementById("week-kw-main").textContent = `KW ${kwNum} · ${refDate.getFullYear()}`;

        const monday = getMonday(refDate);
        const sollSecsPerDay = (sollHours * 3600) + (sollMinutes * 60);
        weekTotalSollSecs = sollSecsPerDay * 5;
        weekStaticCreditedSecs = 0;
        weekHasLiveToday = false;

        const dayShort = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
        for (let i = 0; i < 7; i++) {
            const currDate = new Date(monday);
            currDate.setDate(monday.getDate() + i);
            const dateStr = `${currDate.getFullYear()}-${format2(currDate.getMonth() + 1)}-${format2(currDate.getDate())}`;
            const dateShort = `${format2(currDate.getDate())}.${format2(currDate.getMonth() + 1)}.`;
            const holidayName = getHolidayName(dateStr);
            const isSunday = (i === 6);
            const isSaturday = (i === 5);

            const rawSaved = localStorage.getItem("day_" + dateStr);
            const defaultStatus = holidayName ? 'holiday' : ((isSaturday || isSunday) ? 'free' : 'work');
            let saved = getDayData(dateStr) || { status: defaultStatus, startH: '', startM: '', endH: '', endM: '' };
            if (holidayName && !rawSaved) saved.status = 'holiday';

            if (isSunday && !hasWeekendBooking(saved)) continue;

            const row = document.createElement("div");
            row.className = "week-row" + (dateStr === todayStr ? " is-today" : "");

            const hasStart = saved.startH !== '' && saved.startH !== undefined;
            const hasEnd = saved.endH !== '' && saved.endH !== undefined;
            const smokeSub = (saved.smokeCount && saved.smokeCount > 0) ? ` · 🚬${saved.smokeCount}` : '';
            const splitSub = (saved.sessions && saved.sessions.length > 1) ? ` · ⏸️${saved.sessions.length}` : '';

            let middleHtml = "";
            if (saved.status === 'work') {
                if (hasStart || hasEnd) {
                    middleHtml = `<div class="day-time-display">${hasStart ? `${saved.startH}:${saved.startM || '00'}` : '--:--'} – ${hasEnd ? `${saved.endH}:${saved.endM || '00'}` : 'läuft...'}</div>`;
                } else {
                    middleHtml = `<div class="day-time-display empty">--:-- – --:--</div>`;
                }
            } else if (saved.status === 'holiday') {
                middleHtml = `<div class="day-status-note">🎉 ${holidayName || 'Feiertag'}</div>`;
            } else if (saved.status === 'vacation' || saved.status === 'sick') {
                middleHtml = `<div class="day-status-note">Soll gutgeschrieben</div>`;
            } else {
                middleHtml = `<div class="day-status-note">${(isSaturday || isSunday) ? 'Wochenende (frei)' : 'Gleitzeitabbau'}</div>`;
            }

            row.innerHTML = `<div class="day-label"><strong>${dayShort[i]}</strong><span>${dateShort}${smokeSub}${splitSub}</span></div>${middleHtml}<div class="status-badge-pill" data-status="${saved.status}">${statusLabels[saved.status] || 'Arbeit'}</div>`;
            row.addEventListener("click", () => openDayEditor(dateStr, `${dayFullNames[i]}, ${dateShort}${currDate.getFullYear()}`, isSaturday ? 'work' : defaultStatus));
            container.appendChild(row);

            if (saved.status === 'work') {
                if (dateStr === todayStr) weekHasLiveToday = true;
                else weekStaticCreditedSecs += getDayBreakdown(saved, null).netSecs;
            } else if (saved.status === 'vacation' || saved.status === 'sick' || saved.status === 'holiday') {
                weekStaticCreditedSecs += sollSecsPerDay;
            }
        }
        renderWeekSummaryLive();
    }

    const pdfExportModal = document.getElementById("pdf-export-modal");
    const pdfMonthSelect = document.getElementById("pdfMonthSelect");
    const pdfUserNamePreview = document.getElementById("pdfUserNamePreview");
    const pdfAlsoBackupCheck = document.getElementById("pdfAlsoBackupCheck");

    document.getElementById("btn-open-pdf-modal").addEventListener("click", () => {
        const refDate = new Date();
        refDate.setDate(refDate.getDate() + (weekOffset * 7));
        pdfMonthSelect.value = `${refDate.getFullYear()}-${format2(refDate.getMonth() + 1)}`;
        pdfUserNamePreview.value = userName;
        pdfExportModal.classList.add("active");
    });
    document.getElementById("btn-close-pdf-modal").addEventListener("click", () => pdfExportModal.classList.remove("active"));

    document.getElementById("btn-download-month-pdf").addEventListener("click", () => {
        if (!pdfMonthSelect.value) return;
        const enteredName = pdfUserNamePreview.value.trim();
        if (enteredName !== userName) {
            userName = enteredName;
            userNameInput.value = userName;
            localStorage.setItem("userName", userName);
        }
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("PDF-Bibliothek konnte offline nicht geladen werden. Bitte einmal mit Internet öffnen.");
            return;
        }

        const [yearNum, monthNum] = pdfMonthSelect.value.split("-").map(Number);
        const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
        const dayShortNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
        const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
        const sollSecsPerDay = (sollHours * 3600) + (sollMinutes * 60);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`Arbeitszeitnachweis – ${monthNames[monthNum - 1]} ${yearNum}`, 14, 17);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Mitarbeiter: ${userName || "__________________________"}`, 14, 24);
        doc.text(`Tagessoll (Mo–Fr): ${format2(sollHours)}:${format2(sollMinutes)} h`, 135, 24);
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.3);
        doc.line(14, 27, 196, 27);

        let y = 33;
        const rowH = 6.2;
        const cols = [
            { label: "Datum", x: 15 }, { label: "Tag", x: 36 }, { label: "Status", x: 48 },
            { label: "Kommen", x: 78 }, { label: "Gehen", x: 98 }, { label: "Pause", x: 118 },
            { label: "Ist (Std)", x: 142 }, { label: "Saldo", x: 168 }
        ];

        doc.setFillColor(235, 240, 245);
        doc.rect(14, y - 4.3, 182, rowH, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.8);
        cols.forEach(c => doc.text(c.label, c.x, y));
        y += rowH;

        const fmtHM = (s) => `${format2(Math.floor(Math.abs(s) / 3600))}:${format2(Math.floor((Math.abs(s) % 3600) / 60))}`;
        const fmtSignedHM = (s) => `${s < 0 ? "-" : "+"}${fmtHM(s)}`;

        let monthSollSecs = 0, monthCreditedSecs = 0;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);

        for (let d = 1; d <= daysInMonth; d++) {
            const dt = new Date(yearNum, monthNum - 1, d);
            const dow = dt.getDay(), isWeekend = (dow === 0 || dow === 6);
            const dateStr = `${yearNum}-${format2(monthNum)}-${format2(d)}`;
            const dateDe = `${format2(d)}.${format2(monthNum)}.${yearNum}`;
            const holidayName = getHolidayName(dateStr);

            const rawSaved = localStorage.getItem("day_" + dateStr);
            const defaultStatus = holidayName ? "holiday" : (isWeekend ? "free" : "work");
            const saved = getDayData(dateStr) || { status: defaultStatus, startH: "", startM: "", endH: "", endM: "" };
            if (holidayName && !rawSaved) saved.status = "holiday";

            if (isWeekend) {
                doc.setFillColor(246, 246, 246);
                doc.rect(14, y - 4.3, 182, rowH, "F");
            }

            const daySoll = isWeekend ? 0 : sollSecsPerDay;
            monthSollSecs += daySoll;

            let statusText = statusLabels[saved.status] || "Arbeit";
            if (saved.status === "holiday" && holidayName) {
                statusText = holidayName.length > 15 ? holidayName.slice(0, 14) + "." : holidayName;
            }

            let startTxt = "-", endTxt = "-", pauseTxt = "-", istTxt = "00:00", dayCredited = 0;
            if (saved.status === "work") {
                if (saved.startH !== "" && saved.startH !== undefined) startTxt = `${saved.startH}:${saved.startM || "00"}`;
                if (saved.endH !== "" && saved.endH !== undefined) endTxt = `${saved.endH}:${saved.endM || "00"}`;
                if (saved.sessions && saved.sessions.length > 1) endTxt += ` (${saved.sessions.length}×)`;

                const breakdown = getDayBreakdown(saved, null);
                if (breakdown.presSecs > 0) {
                    pauseTxt = `${Math.round(breakdown.deductSecs / 60)} min`;
                    istTxt = fmtHM(breakdown.netSecs);
                    dayCredited = breakdown.netSecs;
                }
            } else if (saved.status === "vacation" || saved.status === "sick" || saved.status === "holiday") {
                dayCredited = daySoll;
                istTxt = fmtHM(dayCredited);
            }

            monthCreditedSecs += dayCredited;
            const daySaldo = dayCredited - daySoll;
            const saldoTxt = (daySoll === 0 && dayCredited === 0) ? "-" : fmtSignedHM(daySaldo);

            doc.text(dateDe, cols[0].x, y);
            doc.text(dayShortNames[dow], cols[1].x, y);
            doc.text(statusText, cols[2].x, y);
            doc.text(startTxt, cols[3].x, y);
            doc.text(endTxt, cols[4].x, y);
            doc.text(pauseTxt, cols[5].x, y);
            doc.text(istTxt, cols[6].x, y);
            doc.text(saldoTxt, cols[7].x, y);

            doc.setDrawColor(225, 225, 225);
            doc.line(14, y + 1.5, 196, y + 1.5);
            y += rowH;
        }

        y += 2;
        const monthSaldoSecs = monthCreditedSecs - monthSollSecs;
        doc.setFillColor(235, 240, 245);
        doc.rect(14, y - 4.5, 182, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.text(`Monatssumme:   Soll: ${fmtHM(monthSollSecs)} h   |   Ist: ${fmtHM(monthCreditedSecs)} h (${(monthCreditedSecs / 3600).toFixed(2).replace(".", ",")} dez.)   |   Saldo: ${fmtSignedHM(monthSaldoSecs)} h (${(monthSaldoSecs / 3600).toFixed(2).replace(".", ",")})`, 16, y + 0.5);

        y += 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.line(14, y, 85, y);
        doc.text("Datum, Unterschrift Mitarbeiter", 14, y + 4.5);
        doc.line(120, y, 196, y);
        doc.text("Datum, Unterschrift Vorgesetzter", 120, y + 4.5);

        const safeName = (userName || "Stundenzettel").replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
        doc.save(`Stundenzettel_${yearNum}-${format2(monthNum)}_${safeName}.pdf`);

        if (pdfAlsoBackupCheck && pdfAlsoBackupCheck.checked) setTimeout(exportBackupJson, 450);
        pdfExportModal.classList.remove("active");
    });

    /* =========================================================
       4-RICHTUNGS-STEUERUNG
       ========================================================= */
    let touchStartX = 0, touchStartY = 0, touchBlocked = false, stageScrollAtStart = 0;

    document.addEventListener("touchstart", (e) => {
        const anyModalOpen = settingsModal.classList.contains("active")
            || dayEditorModal.classList.contains("active")
            || pdfExportModal.classList.contains("active")
            || backfillModal.classList.contains("active");

        if (!gesturesEnabled || anyModalOpen || e.touches.length !== 1 || e.target.closest("canvas, input, select, textarea, #custom-keypad-sheet, #kw-merged-swipebar")) {
            touchBlocked = true;
            return;
        }
        touchBlocked = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        stageScrollAtStart = viewsStage.scrollTop;
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
        if (!gesturesEnabled || touchBlocked || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const absX = Math.abs(dx), absY = Math.abs(dy);
        const threshold = 55;

        if (absX > threshold && absX > absY * 1.3) {
            if (dx < 0) {
                switchToWeekView();
            } else {
                if (viewWeek.classList.contains("active")) {
                    switchToClockView();
                } else if (welcomeOverlay.classList.contains("active")) {
                    closeWelcomeScreen();
                }
            }
            return;
        }

        if (absY > threshold && absY > absX * 1.3) {
            if (welcomeOverlay.classList.contains("active")) {
                if (dy < 0) {
                    openWelcomeScreen(welcomeActionMode === "come" ? "go" : "come");
                } else {
                    openWelcomeScreen(welcomeActionMode === "go" ? "come" : "go");
                }
            } else if (viewClock.classList.contains("active")) {
                openWelcomeScreen(dy < 0 ? "come" : "go");
            } else if (viewWeek.classList.contains("active")) {
                const maxScroll = Math.max(0, viewsStage.scrollHeight - viewsStage.clientHeight);
                const scrolledDuringSwipe = Math.abs(viewsStage.scrollTop - stageScrollAtStart) > 12;
                const atTopPullingDown = dy > 0 && stageScrollAtStart <= 2 && viewsStage.scrollTop <= 2;
                const atBottomPullingUp = dy < 0 && (maxScroll - stageScrollAtStart) <= 8 && (maxScroll - viewsStage.scrollTop) <= 8;

                if (!scrolledDuringSwipe && (atTopPullingDown || atBottomPullingUp || maxScroll <= 4)) {
                    openWelcomeScreen(dy < 0 ? "come" : "go");
                }
            }
        }
    }, { passive: true });

    /* INITIALISIERUNG HEUTIGER SITZUNG */
    try {
        const todayStr = getTodayStr();
        const savedSessionsRaw = localStorage.getItem("savedTodaySessions");
        if (savedSessionsRaw) {
            const parsed = JSON.parse(savedSessionsRaw);
            if (parsed.date === todayStr && Array.isArray(parsed.sessions)) {
                todaySessions = parsed.sessions;
                syncInputsFromSessions();
                renderSessionsBox();
                calculateAllTimes();
            } else {
                localStorage.removeItem("savedTodaySessions");
            }
        }
    } catch (e) {
        localStorage.removeItem("savedTodaySessions");
    }

    updateAmpelPill();

    const todayAtInit = getTodayStr();
    const dismissedToday = localStorage.getItem("welcomeDismissedDate") === todayAtInit;
    const todayRecordAtInit = getDayData(todayAtInit);
    const hasTimesToday = todaySessions.length > 0
        || (todayRecordAtInit && (
            (todayRecordAtInit.startH !== "" && todayRecordAtInit.startH !== undefined)
            || (todayRecordAtInit.status && todayRecordAtInit.status !== "work" && todayRecordAtInit.status !== "free")
        ));

    if (!dismissedToday && !hasTimesToday) openWelcomeScreen("come");

    /* LIVE-UHR & TIMER */
    function tickLiveEngine() {
        const now = new Date();
        const hh = format2(now.getHours());
        const timeStr = `${hh}:${format2(now.getMinutes())}:${format2(now.getSeconds())}`;
        liveTimeEl.textContent = timeStr;
        if (welcomeBigClockEl) welcomeBigClockEl.textContent = timeStr;
        if (bgHourWatermark) bgHourWatermark.textContent = hh;

        liveDayEl.textContent = `${weekdaysFull[now.getDay()]}, ${format2(now.getDate())}.${format2(now.getMonth() + 1)}.${now.getFullYear()}`;
        if (welcomeOverlay.classList.contains("active")) updateWelcomeGreetingText();

        const pS = getParsedStart();
        const pE = getParsedEnd();
        if (pS && !pE) {
            checkPauseNotifications();
            updateWelcomeWidgets();
            if (viewClock.classList.contains("active")) {
                calculateWorkingTime();
                if (todaySessions.length > 1) {
                    const { totalPresSecs } = getSessionMetrics(getNowSecsOfDay());
                    sessionsPresSum.textContent = `Anwesenheit: ${format2(Math.floor(totalPresSecs / 3600))}:${format2(Math.floor((totalPresSecs % 3600) / 60))} h`;
                }
            }
        } else {
            updateWelcomeWidgets();
        }

        if (viewWeek.classList.contains("active") && weekHasLiveToday) {
            renderWeekSummaryLive();
        }
    }

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) tickLiveEngine();
    });

    /* SUBTILES HAPTIK-FEEDBACK BEI INTERAKTION (6 ms) */
    document.addEventListener("pointerdown", (e) => {
        if (!("vibrate" in navigator)) return;
        const target = e.target.closest("button, .kg-pill, .week-row, .settings-nav-card, .scribble-accordion-btn, .scribble-svg-chip, .day-status-chip, .widget-mode-pill, .icon-variant-card, .kp-key");
        if (target && !target.disabled) {
            try { navigator.vibrate(6); } catch (err) {}
        }
    }, { passive: true });

    tickLiveEngine();
    setInterval(tickLiveEngine, 1000);
});