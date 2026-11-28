/* =========================================================
   STEMPELUHR & WOCHENÜBERSICHT — ANWENDUNGSLOGIK (VERSION 2.0.3)
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    const mods = window.StempeluhrModules || {};
    const SCRIBBLE_ICONS = mods.SCRIBBLE_ICONS || [];
    const makeScribbleSvg = mods.makeScribbleSvg || ((iconObj) => `<svg viewBox="0 0 36 36">${iconObj.inner}</svg>`);
    const getHolidayName = mods.getHolidayName || (() => null);
    const getRotatedPhrase = mods.getRotatedPhrase || null;

    const format2 = (val) => String(val).padStart(2, '0');
    const getTodayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${format2(now.getMonth() + 1)}-${format2(now.getDate())}`;
    };

    const versionLabelEl = document.getElementById("app-version-label");
    if (versionLabelEl) versionLabelEl.textContent = `Version ${typeof APP_VERSION !== "undefined" ? APP_VERSION : "2.0.3"}`;

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
                if (confirm("Notfall-Update jetzt ausführen und Cache leeren?")) forceAppReload();
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
        const options = { body, icon: iconFile, badge: iconFile, tag, renotify: true };
        try {
            if ("serviceWorker" in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && reg.showNotification) {
                    await reg.showNotification(title, options);
                    return;
                }
            }
        } catch (e) {}
        try { new Notification(title, options); } catch (e) {}
    }

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
        const hasFinal = !!saved.dayFinalized;
        const hasNonFreeStatus = saved.status && saved.status !== 'free' && saved.status !== 'work';
        return hasTimes || hasSmoke || hasFinal || hasNonFreeStatus;
    }

    /* =========================================================
       BACKUP-FUNKTIONEN
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
        if (isNaN(lastMs)) { backupStatusPill.textContent = "Gesichert"; return; }
        const diffDays = Math.floor((Date.now() - lastMs) / 86400000);
        if (diffDays <= 0) backupStatusPill.textContent = "Heute gesichert";
        else if (diffDays === 1) backupStatusPill.textContent = "Vor 1 Tag";
        else if (diffDays >= 30) {
            backupStatusPill.textContent = `Vor ${diffDays} Tagen!`;
            backupStatusPill.classList.add("is-due");
        } else backupStatusPill.textContent = `Vor ${diffDays} Tagen`;
    }

    function exportBackupJson() {
        const payload = {
            app: "Stempeluhr",
            version: typeof APP_VERSION !== "undefined" ? APP_VERSION : "2.0.3",
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
                keys.forEach((k) => { if (typeof parsed.storage[k] === "string") localStorage.setItem(k, parsed.storage[k]); });
                alert("Backup erfolgreich wiederhergestellt! Die App wird neu geladen.");
                window.location.reload();
            } catch (err) { alert("Fehler beim Lesen der Backup-Datei."); }
        };
        reader.readAsText(file);
    });

    let userName = localStorage.getItem("userName") || "";
    let phrasesEnabled = localStorage.getItem("phrasesEnabled") !== "false";
    let phraseProfile = localStorage.getItem("phraseProfile") || "uni";
    if (!["male", "female", "uni"].includes(phraseProfile)) phraseProfile = "uni";
    let activeWelcomePhrase = "";

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
        if (Array.isArray(rawArr)) selectedScribbles = rawArr.filter(id => SCRIBBLE_ICONS.some(ic => ic.id === id)).slice(0, 5);
    } catch (e) {}

    let scribbleSizePct = parseInt(localStorage.getItem("scribbleSizePct"), 10);
    if (isNaN(scribbleSizePct)) scribbleSizePct = 50;
    scribbleSizePct = Math.min(100, Math.max(15, scribbleSizePct));

    let appIconTheme = localStorage.getItem("appIconTheme") === "rose" ? "rose" : "blue";

    const initialTodayData = getDayData(getTodayStr());
    let todaySmokeCount = (initialTodayData && typeof initialTodayData.smokeCount === "number") ? initialTodayData.smokeCount : 0;
    let todayFinalized = !!(initialTodayData && initialTodayData.dayFinalized);

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
            updateAccordionBadges();
            updateSettingsNavPreviews();
        });
    });

    document.documentElement.setAttribute("data-style", appStyleMode);
    applyAsymIntensity(appAsymIntensity);
    applyThemeColors(appHue, appLightness);

    const scribbleAccordionMeta = document.getElementById("scribble-accordion-meta");
    const scribbleMiniStrip = document.getElementById("scribble-mini-strip");
    const scribbleSvgGrid = document.getElementById("scribble-svg-grid");
    const scribbleCountTag = document.getElementById("scribble-count-tag");
    const scribbleSizeSlider = document.getElementById("scribbleSizeSlider");
    const scribbleSizeVal = document.getElementById("scribbleSizeVal");
    const navWorkSummary = document.getElementById("nav-work-summary");
    const navWidgetsSummary = document.getElementById("nav-widgets-summary");
    const navDesignSummary = document.getElementById("nav-design-summary");

    function updateAccordionBadges() {
        const mSoll = document.getElementById("acc-meta-soll");
        if (mSoll) mSoll.textContent = `${format2(sollHours)}:${format2(sollMinutes)} Std`;

        const mNotify = document.getElementById("acc-meta-notify");
        if (mNotify) mNotify.textContent = pauseNotifyEnabled ? `An (${pauseNotifyLeadMins}m)` : "Aus";

        const mSmoke = document.getElementById("acc-meta-smoke");
        if (mSmoke) mSmoke.textContent = isSmoker ? `An (${smokeMinutesPerBreak}m)` : "Aus";

        const mAmpel = document.getElementById("acc-meta-ampel");
        if (mAmpel) mAmpel.textContent = `${String(glzBaseHours).replace(".", ",")}h · ${String(weeklyHours).replace(".", ",")}h/Wo`;

        const mPhrases = document.getElementById("acc-meta-phrases");
        if (mPhrases) {
            const pLabel = phraseProfile === "male" ? "Männlich" : (phraseProfile === "female" ? "Weiblich" : "Uni");
            mPhrases.textContent = phrasesEnabled ? `An · ${pLabel}` : `Aus · ${pLabel}`;
        }

        const mSollW = document.getElementById("acc-meta-soll-widget");
        if (mSollW) mSollW.textContent = sollWidgetEnabled ? "Aktiv" : "Aus";

        const mPauseW = document.getElementById("acc-meta-pause-widget");
        if (mPauseW) mPauseW.textContent = pauseWatcherEnabled ? "Aktiv" : "Aus";

        const mKb = document.getElementById("acc-meta-keyboard");
        if (mKb) mKb.textContent = keyboardMode === "system" ? "System" : "App";

        const mForm = document.getElementById("acc-meta-form");
        if (mForm) mForm.textContent = appStyleMode === "asymmetric" ? `Asym. ${appAsymIntensity}%` : "Klassisch";

        const mColor = document.getElementById("acc-meta-color");
        if (mColor) mColor.textContent = `${appLightness}%`;

        const mIcon = document.getElementById("acc-meta-icon");
        if (mIcon) mIcon.textContent = appIconTheme === "rose" ? "Rosé / Berry" : "Blau / Cyan";

        if (scribbleAccordionMeta) scribbleAccordionMeta.textContent = `${selectedScribbles.length}/5 · ${scribbleSizePct}%`;
        if (scribbleMiniStrip) {
            scribbleMiniStrip.innerHTML = "";
            if (selectedScribbles.length === 0) scribbleMiniStrip.innerHTML = `<span style="font-size:0.68em; color:#fff; opacity:0.8;">aus</span>`;
            else selectedScribbles.forEach(id => {
                const found = SCRIBBLE_ICONS.find(ic => ic.id === id);
                if (found) scribbleMiniStrip.innerHTML += makeScribbleSvg(found);
            });
        }
    }

    function collapseAccordionsInGroup(groupName, exceptCard = null) {
        document.querySelectorAll(`.section-accordion-card[data-acc-group="${groupName}"]`).forEach((card) => {
            if (card === exceptCard) return;
            card.classList.remove("is-open");
            const btn = card.querySelector(".section-accordion-btn");
            if (btn) btn.setAttribute("aria-expanded", "false");
        });
    }

    document.querySelectorAll(".section-accordion-card").forEach((card) => {
        const groupName = card.getAttribute("data-acc-group");
        const btn = card.querySelector(".section-accordion-btn");
        if (!btn) return;
        btn.addEventListener("click", () => {
            const willOpen = !card.classList.contains("is-open");
            collapseAccordionsInGroup(groupName, willOpen ? card : null);
            card.classList.toggle("is-open", willOpen);
            btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
            if (willOpen && card.querySelector("#colorWheel")) drawColorWheel();
        });
    });

    function updateSettingsNavPreviews() {
        if (navWorkSummary) {
            const smokeTxt = isSmoker ? `Raucher ${smokeMinutesPerBreak}m` : "Raucher aus";
            const pushTxt = pauseNotifyEnabled ? ` · Push ${pauseNotifyLeadMins}m` : "";
            navWorkSummary.textContent = `${format2(sollHours)}:${format2(sollMinutes)}/Tag · ${weeklyHours}h/Wo · ${smokeTxt}${pushTxt}`;
        }
        if (navWidgetsSummary) {
            const wTxt = sollWidgetEnabled || pauseWatcherEnabled ? "Widgets aktiv" : "Widgets aus";
            const phTxt = phrasesEnabled ? "Sprüche an" : "Sprüche aus";
            navWidgetsSummary.textContent = `${wTxt} · ${phTxt}`;
        }
        if (navDesignSummary) {
            const styleTxt = appStyleMode === "asymmetric" ? `Asymmetrisch (${appAsymIntensity}%)` : "Klassisch";
            const iconTxt = appIconTheme === "rose" ? "Icon Rosé" : "Icon Blau";
            navDesignSummary.textContent = `${styleTxt} · ${selectedScribbles.length} Scribbles · ${iconTxt}`;
        }
    }

    function renderScribblePicker() {
        scribbleCountTag.textContent = `${selectedScribbles.length} / 5`;
        updateAccordionBadges();
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
        updateAccordionBadges();
    });

    /* =========================================================
       SCREEN 1: START + ORB (GOLDENE RATIO HOCH / RUNTER)
       ========================================================= */
    const welcomeOverlay = document.getElementById("welcome-overlay");
    const welcomeScatterField = document.getElementById("welcome-scatter-field");
    const welcomeGreetingEl = document.getElementById("welcome-greeting");
    const welcomeDateSubEl = document.getElementById("welcome-date-sub");
    const welcomeBigClockEl = document.getElementById("welcome-big-clock");
    const btnWelcomeAction = document.getElementById("btn-welcome-action");
    const welcomeActionTitle = document.getElementById("welcome-action-title");
    const welcomeActionSub = document.getElementById("welcome-action-sub");
    const orbGestureHint = document.getElementById("orb-gesture-hint");
    const btnWelcomeMenu = document.getElementById("btn-welcome-menu");

    const welcomeStatusCard = document.getElementById("welcome-status-card");
    const welcomeStatusText = document.getElementById("welcome-status-text");
    const welcomeStatusSub = document.getElementById("welcome-status-sub");
    const clockStatusCard = document.getElementById("clock-status-card");
    const clockStatusLabel = document.getElementById("clock-status-label");
    const clockStatusDetail = document.getElementById("clock-status-detail");

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

    const PHI_THRESHOLD_PX = Math.round(48 * 1.618); // ~78px über die goldene Ratio
    let orbModeActive = false;
    let orbArmedDecision = null; // "finalize" | "cancel" | null
    let orbStartX = 0, orbStartY = 0;
    let longPressGoTimer = null;
    let suppressNextActionClick = false;
    let orbGestureLock = false;
    let orbReleaseCooldownUntil = 0;

    function isOrbGestureProtected() {
        return orbModeActive || orbGestureLock || Date.now() < orbReleaseCooldownUntil;
    }

    function formatSecsToHhMmSs(totalSecs) {
        const s = Math.max(0, Math.floor(totalSecs));
        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = s % 60;
        return `${format2(hh)}:${format2(mm)}:${format2(ss)}`;
    }

    function getLogicalNextMode() {
        const lastSess = todaySessions.length > 0 ? todaySessions[todaySessions.length - 1] : null;
        if (lastSess && lastSess.start && (!lastSess.end || !lastSess.end.h)) return "go";
        return "come";
    }

    function getStampStatusInfo() {
        const pS = getParsedStart();
        const pE = getParsedEnd();
        const lastSess = todaySessions.length > 0 ? todaySessions[todaySessions.length - 1] : null;
        const hasOpenSession = (lastSess && lastSess.start && (!lastSess.end || !lastSess.end.h)) || (pS && !pE);

        if (todayFinalized && !hasOpenSession) {
            const untilStr = pE ? `${pE.h}:${pE.m}` : "jetzt";
            return {
                state: "final",
                cardLabel: "Feierabend · Schluss für heute",
                cardDetail: pE ? `Gegangen um ${untilStr} Uhr` : "Tag beendet"
            };
        }

        if (hasOpenSession) {
            const sinceStr = pS ? `${pS.h}:${pS.m}` : (lastSess && lastSess.start ? `${format2(parseInt(lastSess.start.h, 10) || 0)}:${format2(parseInt(lastSess.start.m, 10) || 0)}` : "--:--");
            return {
                state: "in",
                cardLabel: "Eingestempelt",
                cardDetail: `Aktiv seit ${sinceStr} Uhr`
            };
        }

        if (pE) {
            const untilStr = `${pE.h}:${pE.m}`;
            return {
                state: "out",
                cardLabel: "Ausgestempelt",
                cardDetail: pS ? `Letzter Block: ${pS.h}:${pS.m} – ${untilStr} Uhr` : `Ausgestempelt um ${untilStr} Uhr`
            };
        }

        return {
            state: "neutral",
            cardLabel: "Nicht eingestempelt",
            cardDetail: "Heute noch keine Stempelung erfasst"
        };
    }

    function updateStampStatusUI() {
        const info = getStampStatusInfo();

        if (welcomeStatusCard && welcomeStatusText && welcomeStatusSub) {
            welcomeStatusCard.classList.remove("is-stamped-in", "is-stamped-out", "is-finalized", "is-neutral");
            if (info.state === "final") welcomeStatusCard.classList.add("is-finalized");
            else if (info.state === "in") welcomeStatusCard.classList.add("is-stamped-in");
            else if (info.state === "out") welcomeStatusCard.classList.add("is-stamped-out");
            else welcomeStatusCard.classList.add("is-neutral");

            welcomeStatusText.textContent = info.cardLabel;
            welcomeStatusSub.textContent = info.cardDetail;
        }

        if (clockStatusCard && clockStatusLabel && clockStatusDetail) {
            clockStatusCard.classList.remove("is-stamped-in", "is-stamped-out", "is-finalized", "is-neutral");
            if (info.state === "final") clockStatusCard.classList.add("is-finalized");
            else if (info.state === "in") clockStatusCard.classList.add("is-stamped-in");
            else if (info.state === "out") clockStatusCard.classList.add("is-stamped-out");
            else clockStatusCard.classList.add("is-neutral");

            clockStatusLabel.textContent = info.cardLabel;
            clockStatusDetail.textContent = info.cardDetail;
        }
    }

    function getRequiredPresenceSecs(targetNetSecs, smokeSecs = 0) {
        const cleanNet = Math.max(0, targetNetSecs);
        const cleanSmoke = Math.max(0, smokeSecs);
        if (cleanNet + cleanSmoke < 23400) return cleanNet + cleanSmoke;
        const deduct30 = Math.max(1800, cleanSmoke);
        const presWith30 = cleanNet + deduct30;
        if (presWith30 < 35100) return presWith30;
        const deduct45 = Math.max(2700, cleanSmoke);
        return cleanNet + deduct45;
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

        const pS = getParsedStart();
        const sollTotalSecs = (sollHours * 3600) + (sollMinutes * 60);
        if (!modeMatches || !pS || sollTotalSecs <= 0 || todayFinalized) {
            welcomeSollWidget.style.display = "none";
            return;
        }

        const stH = parseInt(pS.h, 10);
        const stM = parseInt(pS.m, 10) || 0;
        const stS = (todaySessions.length > 0 && todaySessions[0].start) ? (parseInt(todaySessions[0].start.s, 10) || 0) : 0;
        const { totalGapSecs } = getSessionMetrics(null);
        const smokeSecs = getTodaySmokeSecs();

        const requiredPresSecs = getRequiredPresenceSecs(sollTotalSecs, smokeSecs);
        const startDate = new Date();
        startDate.setHours(stH, stM, stS, 0);
        const targetDate = new Date(startDate.getTime() + (requiredPresSecs + totalGapSecs) * 1000);

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
        if (!nodeEl || orbModeActive) return;
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

    function resetOrbState() {
        clearTimeout(longPressGoTimer);
        longPressGoTimer = null;
        if (orbModeActive) {
            orbReleaseCooldownUntil = Date.now() + 150;
        }
        orbModeActive = false;
        orbArmedDecision = null;
        orbGestureLock = false;
        welcomeOverlay.classList.remove("orb-active");
        btnWelcomeAction.classList.remove("is-round-drag", "armed-finalize", "armed-cancel");
        btnWelcomeAction.style.transform = "";
        if (orbGestureHint) orbGestureHint.style.display = "none";
        syncActionButtonVisuals();
    }

    function activateOrbMode(clientX, clientY) {
        orbModeActive = true;
        orbGestureLock = true;
        orbArmedDecision = null;
        orbStartX = clientX || 0;
        orbStartY = clientY || 0;
        suppressNextActionClick = true;

        welcomeOverlay.classList.add("orb-active");
        btnWelcomeAction.classList.add("is-round-drag");
        btnWelcomeAction.classList.remove("armed-finalize", "armed-cancel");
        welcomeActionTitle.textContent = "Orb";
        if (orbGestureHint) {
            orbGestureHint.style.display = "inline-block";
            orbGestureHint.textContent = "↑ Feierabend · ↓ Zurück";
        }
        if ("vibrate" in navigator) {
            try { navigator.vibrate([12, 25, 16]); } catch (e) {}
        }
    }

    function updateOrbPosition(clientX, clientY) {
        if (!orbModeActive) return;
        const dx = clientX - orbStartX;
        const dy = clientY - orbStartY;
        btnWelcomeAction.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;

        const prevDecision = orbArmedDecision;
        if (dy <= -PHI_THRESHOLD_PX) {
            orbArmedDecision = "finalize";
        } else if (dy >= PHI_THRESHOLD_PX) {
            orbArmedDecision = "cancel";
        } else {
            orbArmedDecision = null;
        }

        btnWelcomeAction.classList.toggle("armed-finalize", orbArmedDecision === "finalize");
        btnWelcomeAction.classList.toggle("armed-cancel", orbArmedDecision === "cancel");

        if (orbArmedDecision === "finalize") {
            welcomeActionTitle.textContent = "Schluss";
            if (orbGestureHint) orbGestureHint.textContent = "Loslassen für Feierabend";
        } else if (orbArmedDecision === "cancel") {
            welcomeActionTitle.textContent = "Zurück";
            if (orbGestureHint) orbGestureHint.textContent = "Loslassen zum Abbrechen";
        } else {
            welcomeActionTitle.textContent = "Orb";
            if (orbGestureHint) orbGestureHint.textContent = "↑ Feierabend · ↓ Zurück";
        }

        if (prevDecision !== orbArmedDecision && orbArmedDecision && "vibrate" in navigator) {
            try { navigator.vibrate(8); } catch (e) {}
        }
    }

    function releaseOrbMode() {
        if (!orbModeActive) {
            orbGestureLock = false;
            return;
        }
        const decision = orbArmedDecision;
        resetOrbState();
        if (decision === "finalize") {
            todayFinalized = true;
            triggerStampGoNow();
        }
    }

    function renderWelcomeScatter() {
        resetOrbState();
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
                if (Math.hypot(dx, dy) < minDistPct) { tooClose = true; break; }
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
            if (idx % 4 === 0) setTimeout(() => triggerNodeMicroAnim(node, "anim-pixel-spin"), 160 + idx * 75);
        });
    }

    function startAmbientPixelAnimations() {
        stopAmbientPixelAnimations();
        ambientAnimTimer = setInterval(() => {
            if (!welcomeOverlay.classList.contains("active") || orbModeActive) return;
            const nodes = welcomeScatterField.querySelectorAll(".scatter-node");
            if (nodes.length === 0) return;
            const rndNode = nodes[Math.floor(Math.random() * nodes.length)];
            const anims = ["anim-pixel-spin", "anim-pixel-spin", "anim-pixel-pop", "anim-pixel-wiggle"];
            triggerNodeMicroAnim(rndNode, anims[Math.floor(Math.random() * anims.length)]);
        }, 2200);
    }

    function stopAmbientPixelAnimations() {
        if (ambientAnimTimer) { clearInterval(ambientAnimTimer); ambientAnimTimer = null; }
    }

    function getDefaultGreetingText() {
        const hr = new Date().getHours();
        const cleanName = (userName || "").trim();
        let salutation = "Guten Tag";
        if (hr < 11) salutation = "Guten Morgen";
        else if (hr >= 18) salutation = "Guten Abend";
        return cleanName ? `${salutation}, ${cleanName}!` : `${salutation}!`;
    }

    function updateWelcomeGreetingText(overridePhrase = null) {
        const now = new Date();
        if (typeof overridePhrase === "string" && overridePhrase.trim() !== "") activeWelcomePhrase = overridePhrase.trim();
        else if (!phrasesEnabled || !activeWelcomePhrase) activeWelcomePhrase = getDefaultGreetingText();
        welcomeGreetingEl.textContent = activeWelcomePhrase;
        const dayName = weekdaysFull[now.getDay()];
        welcomeDateSubEl.textContent = `${dayName}, ${format2(now.getDate())}.${format2(now.getMonth() + 1)}.${now.getFullYear()}`;
    }

    function syncActionButtonVisuals() {
        if (orbModeActive) return;
        if (welcomeActionMode === "go") {
            btnWelcomeAction.classList.add("mode-go");
            btnWelcomeMenu.classList.add("mode-go");
            welcomeActionTitle.textContent = "Gehen";
            welcomeActionSub.textContent = "Jetzt ausstempeln · lang halten für Feierabend-Orb";
        } else {
            btnWelcomeAction.classList.remove("mode-go");
            btnWelcomeMenu.classList.remove("mode-go");
            welcomeActionTitle.textContent = "Kommen";
            welcomeActionSub.textContent = "Jetzt direkt einstempeln";
        }
    }

    function openWelcomeScreen(mode = null) {
        const targetMode = mode || getLogicalNextMode();
        const wasAlreadyOpen = welcomeOverlay.classList.contains("active");
        welcomeActionMode = targetMode;
        syncActionButtonVisuals();

        if (metaThemeColor) metaThemeColor.setAttribute("content", window.hslToHex(appHue, 44, 22));

        updateWelcomeGreetingText();
        updateStampStatusUI();
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
        resetOrbState();
        stopAmbientPixelAnimations();
        welcomeOverlay.classList.remove("active", "welcome-mode-switch");
        if (welcomeSollWidget) welcomeSollWidget.style.display = "none";
        if (welcomePauseWidget) welcomePauseWidget.style.display = "none";
        localStorage.setItem("welcomeDismissedDate", getTodayStr());
        applyThemeColors(appHue, appLightness);
    }

    /* =========================================================
       VOLLBILD-ANSICHTEN: UHR / WOCHE / MENÜ
       ========================================================= */
    const viewsStage = document.getElementById("views-stage");
    const viewClock = document.getElementById("view-clock");
    const viewWeek = document.getElementById("view-week");
    const viewMenu = document.getElementById("view-menu");
    const toggleViewBtn = document.getElementById("btn-toggle-view");
    const iconViewWeek = document.getElementById("icon-view-week");
    const iconViewClock = document.getElementById("icon-view-clock");
    const weekDatePicker = document.getElementById("week-date-picker");
    let weekOffset = 0;

    function setActiveMainView(targetView) {
        if (welcomeOverlay.classList.contains("active")) closeWelcomeScreen();
        closeCustomKeypad();
        viewClock.classList.toggle("active", targetView === "clock");
        viewWeek.classList.toggle("active", targetView === "week");
        viewMenu.classList.toggle("active", targetView === "menu");
        viewsStage.scrollTop = 0;

        if (targetView === "week") {
            iconViewWeek.style.display = "none";
            iconViewClock.style.display = "block";
            toggleViewBtn.title = "Uhr";
            buildWeekView();
        } else {
            iconViewWeek.style.display = "block";
            iconViewClock.style.display = "none";
            toggleViewBtn.title = "Woche";
            if (targetView === "clock") calculateAllTimes();
        }
    }

    function switchToClockView() { setActiveMainView("clock"); }
    function switchToWeekView() { weekOffset = 0; setActiveMainView("week"); }

    toggleViewBtn.addEventListener("click", () => {
        if (viewWeek.classList.contains("active")) switchToClockView();
        else switchToWeekView();
    });

    function changeWeek(delta) { weekOffset += delta; buildWeekView(); }
    function jumpToCurrentWeek() { if (weekOffset !== 0) { weekOffset = 0; buildWeekView(); } }
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

    document.getElementById("btn-prev-week").addEventListener("click", (e) => { e.stopPropagation(); changeWeek(-1); });
    document.getElementById("btn-next-week").addEventListener("click", (e) => { e.stopPropagation(); changeWeek(1); });
    document.getElementById("week-kw-badge").addEventListener("click", (e) => { e.stopPropagation(); jumpToCurrentWeek(); });
    weekDatePicker.addEventListener("change", () => jumpToDateStr(weekDatePicker.value));

    const kwMergedSwipebar = document.getElementById("kw-merged-swipebar");
    let kwBarStartX = 0, kwBarDidSwipe = false;
    kwMergedSwipebar.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) { kwBarStartX = e.touches[0].clientX; kwBarDidSwipe = false; }
    }, { passive: true });
    kwMergedSwipebar.addEventListener("touchmove", (e) => {
        if (e.touches.length === 1 && Math.abs(e.touches[0].clientX - kwBarStartX) > 22) kwBarDidSwipe = true;
    }, { passive: true });
    kwMergedSwipebar.addEventListener("touchend", (e) => {
        if (e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - kwBarStartX;
        if (Math.abs(dx) > 36) { e.preventDefault(); e.stopPropagation(); changeWeek(dx < 0 ? 1 : -1); }
    });
    kwMergedSwipebar.addEventListener("click", (e) => {
        if (kwBarDidSwipe) { e.preventDefault(); e.stopPropagation(); kwBarDidSwipe = false; }
    }, true);

    /* =========================================================
       MENÜ-EINSTELLUNGEN (DIREKT & AUTOMATISCH GESPEICHERT)
       ========================================================= */
    const userNameInput = document.getElementById("userNameInput");
    const phrasesEnabledCheck = document.getElementById("phrasesEnabledCheck");
    const phrasesOptionsWrap = document.getElementById("phrases-options-wrap");
    const phraseProfilePills = document.getElementById("phrase-profile-pills");

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
    phrasesEnabledCheck.checked = phrasesEnabled;
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

    function persistAllSettings() {
        userName = userNameInput.value.trim();
        phrasesEnabled = phrasesEnabledCheck.checked;
        sollHours = Math.min(24, Math.max(0, parseInt(sollHoursInput.value, 10) || 0));
        sollMinutes = Math.min(59, Math.max(0, parseInt(sollMinutesInput.value, 10) || 0));

        const parsedWeekly = parseFloat(String(weeklyHoursInput.value).replace(',', '.'));
        weeklyHours = (!isNaN(parsedWeekly) && parsedWeekly > 0 && parsedWeekly <= 48) ? parsedWeekly : 40;

        const parsedGlzBase = parseFloat(String(glzBaseInput.value).replace(',', '.'));
        glzBaseHours = !isNaN(parsedGlzBase) ? parsedGlzBase : 0;

        glzBaseDate = glzBaseDateInput.value || "";

        pauseNotifyEnabled = pauseNotifyCheck.checked && ("Notification" in window) && Notification.permission === "granted";
        pauseNotifyLeadMins = Math.min(60, Math.max(1, parseInt(pauseNotifyLeadInput.value, 10) || 10));

        sollWidgetEnabled = sollWidgetEnabledCheck.checked;
        pauseWatcherEnabled = pauseWatcherEnabledCheck.checked;

        appStyleMode = styleModeSelect.value;
        appAsymIntensity = applyAsymIntensity(asymIntensitySlider.value);
        document.documentElement.setAttribute("data-style", appStyleMode);

        isSmoker = isSmokerCheck.checked;
        smokeMinutesPerBreak = Math.min(60, Math.max(1, parseInt(smokeMinutesInput.value, 10) || 5));
        gesturesEnabled = gesturesEnabledCheck.checked;

        localStorage.setItem("userName", userName);
        localStorage.setItem("phrasesEnabled", phrasesEnabled);
        localStorage.setItem("phraseProfile", phraseProfile);
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

        if (!phrasesEnabled) activeWelcomePhrase = getDefaultGreetingText();
        if (window.applyAppIconTheme) window.applyAppIconTheme(appIconTheme);
        applyThemeColors(appHue, appLightness);
        applyKeyboardModeToInputs();
        if (isSmoker) saveTodaySmokeData();
        updateSmokerUI();
        updateAccordionBadges();
        updateSettingsNavPreviews();
        updateWelcomeGreetingText();
        calculateAllTimes();
        checkPauseNotifications();
        updateWelcomeWidgets();
        if (viewWeek.classList.contains("active")) buildWeekView();
        else updateAmpelPill();
    }

    userNameInput.addEventListener("input", persistAllSettings);
    gesturesEnabledCheck.addEventListener("change", persistAllSettings);
    glzBaseDateInput.addEventListener("change", persistAllSettings);

    function syncPhrasesSettingsUI() {
        phrasesOptionsWrap.style.opacity = phrasesEnabled ? "1" : "0.45";
        phrasesOptionsWrap.style.pointerEvents = phrasesEnabled ? "auto" : "none";
        phraseProfilePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
            const isSel = pill.getAttribute("data-ph-profile") === phraseProfile;
            pill.classList.toggle("selected", isSel);
            pill.setAttribute("aria-checked", isSel ? "true" : "false");
        });
    }

    phrasesEnabledCheck.addEventListener("change", () => {
        phrasesEnabled = phrasesEnabledCheck.checked;
        if (!phrasesEnabled) activeWelcomePhrase = getDefaultGreetingText();
        syncPhrasesSettingsUI();
        persistAllSettings();
    });

    phraseProfilePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            const nextProf = pill.getAttribute("data-ph-profile");
            if (["male", "female", "uni"].includes(nextProf)) {
                phraseProfile = nextProf;
                syncPhrasesSettingsUI();
                persistAllSettings();
            }
        });
    });

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

    syncPhrasesSettingsUI();
    syncSollWidgetSettingsUI();
    syncPauseWatcherSettingsUI();
    syncKeyboardModeUI();

    sollWidgetEnabledCheck.addEventListener("change", () => {
        sollWidgetEnabled = sollWidgetEnabledCheck.checked;
        syncSollWidgetSettingsUI();
        persistAllSettings();
    });

    sollWidgetModePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            sollWidgetMode = pill.getAttribute("data-sw-mode") || "both";
            syncSollWidgetSettingsUI();
            persistAllSettings();
        });
    });

    pauseWatcherEnabledCheck.addEventListener("change", () => {
        pauseWatcherEnabled = pauseWatcherEnabledCheck.checked;
        syncPauseWatcherSettingsUI();
        persistAllSettings();
    });

    pauseWatcherModePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            pauseWatcherMode = pill.getAttribute("data-pw-mode") || "both";
            syncPauseWatcherSettingsUI();
            persistAllSettings();
        });
    });

    keyboardModePills.querySelectorAll(".widget-mode-pill").forEach((pill) => {
        pill.addEventListener("click", () => {
            keyboardMode = pill.getAttribute("data-kb-mode") === "system" ? "system" : "app";
            syncKeyboardModeUI();
            persistAllSettings();
        });
    });

    function syncStyleControlsUI() { asymSliderWrap.style.display = styleModeSelect.value === "asymmetric" ? "block" : "none"; }
    syncStyleControlsUI();

    styleModeSelect.addEventListener("change", () => {
        appStyleMode = styleModeSelect.value;
        document.documentElement.setAttribute("data-style", appStyleMode);
        syncStyleControlsUI();
        persistAllSettings();
    });

    asymIntensitySlider.addEventListener("input", () => {
        appAsymIntensity = applyAsymIntensity(asymIntensitySlider.value);
        asymIntensityVal.textContent = appAsymIntensity;
        persistAllSettings();
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
                persistAllSettings();
                return;
            }
            let perm = Notification.permission;
            if (perm === "default") perm = await Notification.requestPermission();
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
        } else pauseNotifyEnabled = false;
        updatePauseNotifyUI();
        persistAllSettings();
    });

    function updateSmokerUI() {
        smokerMinsWrap.style.opacity = isSmokerCheck.checked ? "1" : "0.45";
        smokeMinutesInput.disabled = !isSmokerCheck.checked;
        smokeBar.style.display = isSmoker ? "grid" : "none";
        smokeCountDisplay.textContent = `${todaySmokeCount}× (-${todaySmokeCount * smokeMinutesPerBreak}m)`;
    }
    isSmokerCheck.addEventListener("change", () => {
        isSmoker = isSmokerCheck.checked;
        updateSmokerUI();
        persistAllSettings();
    });

    function saveTodaySmokeData() {
        const todayStr = getTodayStr();
        const currentDay = getDayData(todayStr) || { status: 'work', startH: '', startM: '', endH: '', endM: '' };
        currentDay.smokeCount = todaySmokeCount;
        currentDay.smokeTotalMins = todaySmokeCount * smokeMinutesPerBreak;
        currentDay.dayFinalized = todayFinalized;
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
    updateAccordionBadges();
    updateSettingsNavPreviews();
    updateBackupStatusBadge();

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
        persistAllSettings();
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
        localStorage.setItem("appHue", appHue);
    }

    canvas.addEventListener("mousedown", (e) => { handleColorPick(e); canvas.addEventListener("mousemove", handleColorPick); });
    window.addEventListener("mouseup", () => canvas.removeEventListener("mousemove", handleColorPick));
    canvas.addEventListener("touchstart", (e) => { handleColorPick(e); canvas.addEventListener("touchmove", handleColorPick, { passive: false }); }, { passive: false });
    window.addEventListener("touchend", () => canvas.removeEventListener("touchmove", handleColorPick));

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

        if (pageName === "work") {
            collapseAccordionsInGroup("work", null);
            updateAccordionBadges();
        } else if (pageName === "widgets") {
            collapseAccordionsInGroup("widgets", null);
            phrasesEnabledCheck.checked = phrasesEnabled;
            sollWidgetEnabledCheck.checked = sollWidgetEnabled;
            pauseWatcherEnabledCheck.checked = pauseWatcherEnabled;
            syncPhrasesSettingsUI();
            syncSollWidgetSettingsUI();
            syncPauseWatcherSettingsUI();
            syncKeyboardModeUI();
            updateAccordionBadges();
        } else if (pageName === "design") {
            collapseAccordionsInGroup("design", null);
            renderScribblePicker();
            syncIconThemePickerUI();
            updateAccordionBadges();
        } else if (pageName === "main") {
            updateSettingsNavPreviews();
            updateBackupStatusBadge();
        }
    }

    function openSettingsMenu() {
        persistAllSettings();
        showSettingsSubpage("main");
        setActiveMainView("menu");
    }

    document.getElementById("btn-settings").addEventListener("click", openSettingsMenu);
    document.getElementById("btn-open-work-subpage").addEventListener("click", () => showSettingsSubpage("work"));
    document.getElementById("btn-open-widgets-subpage").addEventListener("click", () => showSettingsSubpage("widgets"));
    document.getElementById("btn-open-design-subpage").addEventListener("click", () => showSettingsSubpage("design"));
    document.getElementById("btn-back-from-work").addEventListener("click", () => { persistAllSettings(); showSettingsSubpage("main"); });
    document.getElementById("btn-back-from-widgets").addEventListener("click", () => { persistAllSettings(); showSettingsSubpage("main"); });
    document.getElementById("btn-back-from-design").addEventListener("click", () => { persistAllSettings(); showSettingsSubpage("main"); });
    document.getElementById("btn-close-settings").addEventListener("click", () => { persistAllSettings(); switchToClockView(); });

    document.getElementById("btn-force-update").addEventListener("click", async () => {
        const btn = document.getElementById("btn-force-update");
        btn.textContent = "Suche...";
        btn.disabled = true;
        await forceAppReload();
    });

    /* =========================================================
       GLOBALE ZAHLENTASTATUR-ENGINE (RUHIGE HH:MM-MASKE)
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

    function formatLiveHhMmDigits(digits) {
        const clean = digits.replace(/\D/g, "").slice(0, 4);
        if (!clean) return "";
        if (clean.length === 1) return `${clean}_:__`;
        if (clean.length === 2) return `${clean}:__`;
        if (clean.length === 3) return `${clean.slice(0, 2)}:${clean[2]}_`;
        return `${clean.slice(0, 2)}:${clean.slice(2, 4)}`;
    }

    function finalizeHhMmDigits(digits) {
        const clean = digits.replace(/\D/g, "").slice(0, 4);
        if (!clean) return "";
        let h = 0, m = 0;
        if (clean.length === 1) { h = parseInt(clean, 10) || 0; m = 0; }
        else if (clean.length === 2) { h = parseInt(clean, 10) || 0; m = 0; }
        else if (clean.length === 3) { h = parseInt(clean.slice(0, 2), 10) || 0; m = (parseInt(clean[2], 10) || 0) * 10; }
        else { h = parseInt(clean.slice(0, 2), 10) || 0; m = parseInt(clean.slice(2, 4), 10) || 0; }
        h = Math.min(23, Math.max(0, h));
        m = Math.min(59, Math.max(0, m));
        return `${format2(h)}:${format2(m)}`;
    }

    function parseHhMmString(str) {
        if (!str) return null;
        const trimmed = str.trim();
        if (!trimmed || trimmed.includes("_")) return null;
        const colonMatch = trimmed.match(/^(\d{1,2})\s*[:.,]\s*(\d{1,2})$/);
        if (colonMatch) {
            const h = Math.min(23, Math.max(0, parseInt(colonMatch[1], 10) || 0));
            const m = Math.min(59, Math.max(0, parseInt(colonMatch[2], 10) || 0));
            return { h: format2(h), m: format2(m) };
        }
        const digitsOnly = trimmed.replace(/\D/g, "");
        if (!digitsOnly) return null;
        const formatted = finalizeHhMmDigits(digitsOnly);
        if (!formatted) return null;
        const [hh, mm] = formatted.split(":");
        return { h: hh, m: mm };
    }

    function getParsedStart() { return startTimePill.value.trim() !== "" ? parseHhMmString(startTimePill.value) : null; }
    function getParsedEnd() { return endTimePill.value.trim() !== "" ? parseHhMmString(endTimePill.value) : null; }

    function clearAllKeypadHighlights() {
        pillStartWrap.classList.remove("is-active");
        pillEndWrap.classList.remove("is-active");
        document.querySelectorAll(".keypad-bound-input.kp-focused").forEach(el => el.classList.remove("kp-focused"));
    }

    function openGlobalKeypad(config) {
        if (keyboardMode === "system") return;
        if (kpState && kpState.onCommit) kpState.onCommit(kpState.el, true);
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
        } else kpState.buffer = (kpState.el.value || "").trim();

        keypadTargetBadge.textContent = kpState.label;
        if (kpState.el === startTimePill) pillStartWrap.classList.add("is-active");
        else if (kpState.el === endTimePill) pillEndWrap.classList.add("is-active");
        else kpState.el.classList.add("kp-focused");

        keypadSheet.classList.add("active");
    }

    function closeCustomKeypad() {
        if (kpState) {
            const closingState = kpState;
            if (closingState.mode === "hhmm" && closingState.buffer) {
                closingState.el.value = finalizeHhMmDigits(closingState.buffer);
            }
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
        if (boundKeypadInputs.has(el)) { applyKeyboardModeToInputs(); return; }
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
        el.addEventListener("focus", () => {
            if (keyboardMode !== "system") return;
            setTimeout(() => {
                try {
                    if (typeof el.select === "function") el.select();
                    else if (typeof el.setSelectionRange === "function") el.setSelectionRange(0, el.value.length);
                } catch (e) {}
            }, 0);
        });
        el.addEventListener("input", () => { if (keyboardMode === "system" && opts.onCommit) opts.onCommit(el, false); });
        el.addEventListener("change", () => { if (keyboardMode === "system" && opts.onCommit) opts.onCommit(el, true); });
        el.addEventListener("blur", () => {
            if (keyboardMode !== "system") return;
            if (opts.mode === "hhmm" && el.value.trim()) el.value = finalizeHhMmDigits(el.value);
            if (opts.onCommit) opts.onCommit(el, true);
        });

        applyKeyboardModeToInputs();
    }

    registerKeypadInput(startTimePill, {
        mode: "hhmm", label: "Kommen (hh:mm)", nextEl: endTimePill,
        onCommit: (_, fin) => { if (fin) onManualTimeInputChange(); calculateAllTimes(); }
    }, () => pushUndoSnapshot());

    registerKeypadInput(endTimePill, {
        mode: "hhmm", label: "Gehen (hh:mm)",
        onCommit: (_, fin) => { if (fin) onManualTimeInputChange(); calculateAllTimes(); }
    }, () => pushUndoSnapshot());

    registerKeypadInput(sollHoursInput, { mode: "number", label: "Soll-Stunden (0–24)", min: 0, max: 24, step: 1, nextEl: sollMinutesInput, onCommit: () => persistAllSettings() });
    registerKeypadInput(sollMinutesInput, { mode: "number", label: "Soll-Minuten (0–59)", min: 0, max: 59, step: 5, onCommit: () => persistAllSettings() });
    registerKeypadInput(pauseNotifyLeadInput, { mode: "number", label: "Vorwarnung (Minuten)", min: 1, max: 60, step: 5, onCommit: () => persistAllSettings() });
    registerKeypadInput(smokeMinutesInput, { mode: "number", label: "Minuten pro Raucherpause", min: 1, max: 60, step: 1, onCommit: () => persistAllSettings() });
    registerKeypadInput(glzBaseInput, { mode: "number", label: "GLZ-Startsaldo (h)", min: -200, max: 300, step: 0.5, allowDecimal: true, allowNegative: true, onCommit: () => persistAllSettings() });
    registerKeypadInput(weeklyHoursInput, { mode: "number", label: "Wochenstunden (1–48)", min: 1, max: 48, step: 0.5, allowDecimal: true, onCommit: () => persistAllSettings() });

    document.getElementById("keypad-close-btn").addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation(); closeCustomKeypad();
    });

    function openNextBoundInput(nextTarget) {
        if (!nextTarget || nextTarget.disabled) return;
        if (keyboardMode === "system") { if (typeof nextTarget.focus === "function") nextTarget.focus(); return; }
        if (nextTarget._kpOpts) openGlobalKeypad({ el: nextTarget, ...nextTarget._kpOpts });
    }

    function handleKeypadPress(action) {
        if (!kpState || keyboardMode === "system") return;
        const st = kpState;
        const el = st.el;

        if (st.mode === "hhmm") {
            if (/^[0-9]$/.test(action)) {
                if (st.fresh || st.buffer.length >= 4) { st.buffer = action; st.fresh = false; }
                else st.buffer += action;
                el.value = formatLiveHhMmDigits(st.buffer);
                if (st.onCommit) st.onCommit(el, false);
            } else if (action === "del") {
                st.fresh = false;
                st.buffer = st.buffer.slice(0, -1);
                el.value = st.buffer ? formatLiveHhMmDigits(st.buffer) : "";
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
            } else if (action === "enter") {
                if (st.buffer) el.value = finalizeHhMmDigits(st.buffer);
                const nextTarget = st.nextEl;
                closeCustomKeypad();
                openNextBoundInput(nextTarget);
            }
            return;
        }

        if (/^[0-9]$/.test(action)) {
            if (st.fresh) { st.buffer = action; st.fresh = false; }
            else st.buffer = (st.buffer === "0") ? action : st.buffer + action;
            el.value = st.buffer;
            if (st.onCommit) st.onCommit(el, false);
        } else if (action === "," || action === ".") {
            if (!st.allowDecimal) return;
            if (st.fresh) { st.buffer = "0,"; st.fresh = false; }
            else if (!st.buffer.includes(",") && !st.buffer.includes(".")) {
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
                st.buffer = "-"; st.fresh = false; el.value = st.buffer;
            } else {
                const rawVal = (st.buffer !== "" ? st.buffer : el.value) || "0";
                let num = parseFloat(String(rawVal).replace(",", "."));
                if (isNaN(num)) num = 0;
                num = Math.round((num + (action === "-" ? -st.step : st.step)) * 100) / 100;
                if (!st.allowNegative && num < 0) num = 0;
                if (st.min !== null && num < st.min) num = st.min;
                if (st.max !== null && num > st.max) num = st.max;
                const formatted = String(num).replace(".", ",");
                st.buffer = formatted; st.fresh = false; el.value = formatted;
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
            if (e.cancelable) e.preventDefault(); e.stopPropagation();
            const now = Date.now();
            if (now - lastKeypadKeyTime < 75) return;
            lastKeypadKeyTime = now;
            const action = keyBtn.getAttribute("data-kp");
            if (action) handleKeypadPress(action);
        });
        keyBtn.addEventListener("click", (e) => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); });
    });

    document.addEventListener("pointerdown", (e) => {
        if (!keypadSheet.classList.contains("active")) return;
        if (Date.now() - lastKeypadOpenTime < 220) return;
        if (!e.target.closest("#custom-keypad-sheet") && !e.target.closest(".keypad-bound-input") && !e.target.closest("#pill-start") && !e.target.closest("#pill-end")) {
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
        undoStack.push({ sessions: JSON.parse(JSON.stringify(todaySessions)), smokeCount: todaySmokeCount, dayFinalized: todayFinalized });
        if (undoStack.length > 20) undoStack.shift();
        updateUndoButtonState();
    }

    btnUndo.addEventListener("click", () => {
        if (undoStack.length === 0) return;
        const prev = undoStack.pop();
        todaySessions = prev.sessions || [];
        todaySmokeCount = typeof prev.smokeCount === "number" ? prev.smokeCount : 0;
        todayFinalized = !!prev.dayFinalized;
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

    function computePauseBoundaryTimes() {
        const pS = getParsedStart();
        if (!pS) return { limit30Time: "", limit45Time: "" };
        const hours = parseInt(pS.h, 10);
        const minutes = parseInt(pS.m, 10) || 0;
        const seconds = (todaySessions.length > 0 && todaySessions[0].start) ? (parseInt(todaySessions[0].start.s, 10) || 0) : 0;
        const { totalGapSecs } = getSessionMetrics(null);
        const startTime = new Date();
        startTime.setHours(hours, minutes, seconds, 0);
        const addS = (s) => new Date(startTime.getTime() + (s + totalGapSecs) * 1000);
        const formatT = (d) => `${format2(d.getHours())}:${format2(d.getMinutes())}:${format2(d.getSeconds())}`;
        return { limit30Time: formatT(addS(6 * 3600 + 30 * 60)), limit45Time: formatT(addS(9 * 3600 + 45 * 60)) };
    }

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
        const { limit30Time, limit45Time } = computePauseBoundaryTimes();

        const limit30Secs = 23400;
        if (totalPresSecs >= (limit30Secs - leadSecs) && totalPresSecs < (limit30Secs + 180)) {
            const key30 = `notified_p30_${todayStr}`;
            if (!localStorage.getItem(key30)) {
                localStorage.setItem(key30, "1");
                const remMins = Math.max(0, Math.ceil((limit30Secs - totalPresSecs) / 60));
                showAppNotification("Achtung: 30-Min-Pause droht!", remMins > 0 ? `In ca. ${remMins} Min (ab ${limit30Time}) greift der automatische 30-Min-Pausenabzug.` : `Die 6:30-Std-Grenze (${limit30Time}) ist erreicht – 30 Min Pause werden jetzt abgezogen.`, "pause-30");
            }
        }

        const limit45Secs = 35100;
        if (totalPresSecs >= (limit45Secs - leadSecs) && totalPresSecs < (limit45Secs + 180)) {
            const key45 = `notified_p45_${todayStr}`;
            if (!localStorage.getItem(key45)) {
                localStorage.setItem(key45, "1");
                const remMins = Math.max(0, Math.ceil((limit45Secs - totalPresSecs) / 60));
                showAppNotification("Achtung: 45-Min-Pause droht!", remMins > 0 ? `In ca. ${remMins} Min (ab ${limit45Time}) greift der automatische 45-Min-Pausenabzug.` : `Die 9:45-Std-Grenze (${limit45Time}) ist erreicht – 45 Min Pause werden jetzt abgezogen.`, "pause-45");
            }
        }
    }

    function renderSessionsBox() {
        if (todaySessions.length <= 1) { sessionsBox.style.display = "none"; return; }
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
        } else sessionsBreakInfo.style.display = "none";
    }

    function syncInputsFromSessions() {
        if (todaySessions.length === 0) { startTimePill.value = ""; endTimePill.value = ""; return; }
        startTimePill.value = `${todaySessions[0].start.h}:${todaySessions[0].start.m || "00"}`;
        const last = todaySessions[todaySessions.length - 1];
        endTimePill.value = last.end ? `${last.end.h}:${last.end.m || "00"}` : "";
    }

    function saveSessionsAndDay() {
        const todayStr = getTodayStr();
        renderSessionsBox();

        if (todaySessions.length > 0) localStorage.setItem("savedTodaySessions", JSON.stringify({ date: todayStr, sessions: todaySessions }));
        else localStorage.removeItem("savedTodaySessions");

        const dow = new Date().getDay();
        if (todaySessions.length === 0 && todaySmokeCount === 0 && !todayFinalized && (dow === 0 || dow === 6)) {
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
        currentDay.dayFinalized = todayFinalized;
        saveDayData(todayStr, currentDay);
    }

    function onManualTimeInputChange() {
        const pS = getParsedStart();
        const pE = getParsedEnd();
        if (!pS && !pE) { todaySessions = []; saveSessionsAndDay(); return; }
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
            } else todaySessions[todaySessions.length - 1].end = null;
        }
        saveSessionsAndDay();
    }

    function applyRotatedPhraseFor(direction) {
        if (!phrasesEnabled || typeof getRotatedPhrase !== "function") {
            updateWelcomeGreetingText(getDefaultGreetingText());
            return;
        }
        const phrase = getRotatedPhrase(phraseProfile, direction, userName);
        updateWelcomeGreetingText(phrase);
    }

    function triggerStampComeNow() {
        pushUndoSnapshot();
        todayFinalized = false;
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
        applyRotatedPhraseFor("greeting");
        welcomeActionMode = getLogicalNextMode();
        syncActionButtonVisuals();
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
        applyRotatedPhraseFor("farewell");
        welcomeActionMode = getLogicalNextMode();
        syncActionButtonVisuals();
        calculateAllTimes();
        updateWelcomeWidgets();
    }

    // Long-Press auf Gehen -> Orb + alle Scribbles in Hauptfarbe; Goldene Ratio hoch/runter
    btnWelcomeAction.addEventListener("pointerdown", (e) => {
        if (welcomeActionMode !== "go") return;
        orbGestureLock = true;
        orbStartX = e.clientX;
        orbStartY = e.clientY;
        clearTimeout(longPressGoTimer);
        longPressGoTimer = setTimeout(() => {
            activateOrbMode(orbStartX, orbStartY);
        }, 460);
    });

    window.addEventListener("pointermove", (e) => {
        if (longPressGoTimer && !orbModeActive && Math.hypot(e.clientX - orbStartX, e.clientY - orbStartY) > 12) {
            clearTimeout(longPressGoTimer);
            longPressGoTimer = null;
        }
        if (!orbModeActive) return;
        updateOrbPosition(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener("pointerup", () => {
        clearTimeout(longPressGoTimer);
        longPressGoTimer = null;
        if (orbModeActive) {
            releaseOrbMode();
        } else if (orbGestureLock) {
            orbGestureLock = false;
            orbReleaseCooldownUntil = Date.now() + 150;
        }
    });

    window.addEventListener("pointercancel", () => {
        clearTimeout(longPressGoTimer);
        longPressGoTimer = null;
        if (orbModeActive) {
            resetOrbState();
        } else if (orbGestureLock) {
            orbGestureLock = false;
            orbReleaseCooldownUntil = Date.now() + 150;
        }
    });

    document.getElementById("btn-now-start").addEventListener("click", triggerStampComeNow);
    document.getElementById("btn-now-end").addEventListener("click", triggerStampGoNow);

    btnWelcomeAction.addEventListener("click", () => {
        if (suppressNextActionClick) {
            suppressNextActionClick = false;
            return;
        }
        if (welcomeActionMode === "go") triggerStampGoNow();
        else triggerStampComeNow();
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
        updateStampStatusUI();
        calculateWorkingTime();
        updateWelcomeWidgets();
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
        const isLiveRunning = !pE && !todayFinalized;

        const stS = (todaySessions.length > 0 && todaySessions[0].start) ? (parseInt(todaySessions[0].start.s, 10) || 0) : 0;
        const startSecs = (stH * 3600) + (stM * 60) + stS;

        let endSecs;
        if (isLiveRunning) {
            endSecs = getNowSecsOfDay();
            labelDec.innerHTML = `<span class="live-dot"></span>Bisher (Netto)`;
            labelOver.innerHTML = `<span class="live-dot"></span>Bis Soll (+/-)`;
        } else if (pE) {
            const enH = parseInt(pE.h, 10);
            const enM = parseInt(pE.m, 10) || 0;
            const lastSess = todaySessions[todaySessions.length - 1];
            const enS = (lastSess && lastSess.end) ? (parseInt(lastSess.end.s, 10) || 0) : 0;
            endSecs = (enH * 3600) + (enM * 60) + enS;
            labelDec.textContent = "Dezimal (h)";
            labelOver.textContent = "+/-";
        } else {
            endSecs = getNowSecsOfDay();
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
            } else pauseHintEl.style.display = "none";
        } else {
            decOutputEl.textContent = (netSecs / 3600).toFixed(2);
            pauseHintEl.style.display = "none";
        }
    }

    /* =========================================================
       SCREEN 3: WOCHE & AMPELKONTO
       ========================================================= */
    function getMonday(d) {
        d = new Date(d);
        const day = d.getDay();
        return new Date(d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)));
    }

    function getDayBreakdown(saved, liveEndSecs = null) {
        if (!saved) return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };
        let totalPresSecs = 0, isLive = false;
        const allowLive = liveEndSecs !== null && !saved.dayFinalized;

        if (Array.isArray(saved.sessions) && saved.sessions.length > 0) {
            const hasOpenLast = !saved.sessions[saved.sessions.length - 1].end || saved.sessions[saved.sessions.length - 1].end.h === "";
            if (hasOpenLast && allowLive) {
                isLive = true;
                totalPresSecs = getSessionMetricsFromList(saved.sessions, liveEndSecs).totalPresSecs;
            } else if (saved.customPresSecs && saved.customPresSecs > 0) totalPresSecs = saved.customPresSecs;
            else totalPresSecs = getSessionMetricsFromList(saved.sessions, null).totalPresSecs;
        } else if (saved.customPresSecs && saved.customPresSecs > 0) totalPresSecs = saved.customPresSecs;
        else if (saved.startH !== '' && saved.startH !== undefined) {
            const sh = parseInt(saved.startH, 10), sm = parseInt(saved.startM, 10) || 0;
            if (isNaN(sh)) return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };
            const sSecs = sh * 3600 + sm * 60;
            if (saved.endH !== '' && saved.endH !== undefined) {
                const eh = parseInt(saved.endH, 10), em = parseInt(saved.endM, 10) || 0;
                if (isNaN(eh)) return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };
                const eSecs = eh * 3600 + em * 60;
                if (eSecs <= sSecs) return { presSecs: 0, deductSecs: 0, netSecs: 0, isLive: false };
                totalPresSecs = eSecs - sSecs;
            } else if (allowLive && liveEndSecs > sSecs) {
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
            } else if (saved.status === "free") dayCredited = 0;

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
            infoText = gesamtSaldo > gruenMax
                ? `Gelb · noch ${fmtPlain(gelbMax - gesamtSaldo)}h bis Rot`
                : `Gelb (Minus) · noch ${fmtPlain(gesamtSaldo - gelbMin)}h Puffer`;
        } else {
            statusClass = "ampel-rot";
            infoText = gesamtSaldo > rotMax
                ? `Rot (> ${rotMax.toFixed(0)}h Max!)`
                : (gesamtSaldo < gelbMin ? `Rot (Minus-Grenze!)` : `Rot · Rückführung nötig`);
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
        } else editingDraft = { status: defaultStatus, startH: '', startM: '', endH: '', endM: '', sessions: [], smokeCount: 0, dayFinalized: false };

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
            const startStr = (blk.start && blk.start.h !== "") ? `${format2(parseInt(blk.start.h, 10) || 0)}:${format2(parseInt(blk.start.m, 10) || 0)}` : "";
            const endStr = (blk.end && blk.end.h !== "") ? `${format2(parseInt(blk.end.h, 10) || 0)}:${format2(parseInt(blk.end.m, 10) || 0)}` : "";

            card.innerHTML = `
                <div class="editor-block-header">
                    <span>Zeitblock #${idx + 1}</span>
                    ${editingDraft.sessions.length > 1 ? `<button type="button" class="editor-block-del" data-del-idx="${idx}">Entfernen</button>` : ''}
                </div>
                <div class="editor-time-row">
                    <div class="editor-time-col">
                        <span class="lbl">Kommen</span>
                        <input type="text" inputmode="none" readonly class="ed-start keypad-bound-input editor-hhmm-input" value="${startStr}" placeholder="hh:mm" aria-label="Block ${idx + 1} Kommen hh:mm">
                    </div>
                    <div class="editor-time-col">
                        <span class="lbl">Gehen</span>
                        <input type="text" inputmode="none" readonly class="ed-end keypad-bound-input editor-hhmm-input" value="${endStr}" placeholder="hh:mm" aria-label="Block ${idx + 1} Gehen hh:mm">
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
            const startInp = card.querySelector(".ed-start");
            const endInp = card.querySelector(".ed-end");

            const syncBlockFromInputs = (finalize) => {
                if (!editingDraft || !editingDraft.sessions[idx]) return;
                if (finalize && startInp.value.trim()) startInp.value = finalizeHhMmDigits(startInp.value);
                if (finalize && endInp.value.trim()) endInp.value = finalizeHhMmDigits(endInp.value);

                const blk = editingDraft.sessions[idx];
                const ps = parseHhMmString(startInp.value);
                const pe = parseHhMmString(endInp.value);

                if (!ps) blk.start = null;
                else {
                    const oldS = blk.start;
                    blk.start = { h: ps.h, m: ps.m, s: (oldS && oldS.h === ps.h && oldS.m === ps.m) ? (oldS.s || "00") : "00" };
                }

                if (!pe) blk.end = null;
                else {
                    const oldE = blk.end;
                    blk.end = { h: pe.h, m: pe.m, s: (oldE && oldE.h === pe.h && oldE.m === pe.m) ? (oldE.s || "00") : "00" };
                }
            };

            registerKeypadInput(startInp, { mode: "hhmm", label: `#${idx + 1} Kommen (hh:mm)`, nextEl: endInp, onCommit: (_, fin) => syncBlockFromInputs(fin) });
            registerKeypadInput(endInp, { mode: "hhmm", label: `#${idx + 1} Gehen (hh:mm)`, onCommit: (_, fin) => syncBlockFromInputs(fin) });
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
            todayFinalized = false;
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
            todayFinalized = !!editingDraft.dayFinalized;
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
            const finalSub = saved.dayFinalized ? ` · ✓` : '';

            let middleHtml = "";
            if (saved.status === 'work') {
                if (hasStart || hasEnd) {
                    middleHtml = `<div class="day-time-display">${hasStart ? `${saved.startH}:${saved.startM || '00'}` : '--:--'} – ${hasEnd ? `${saved.endH}:${saved.endM || '00'}` : (saved.dayFinalized ? 'schluss' : 'läuft...')}</div>`;
                } else middleHtml = `<div class="day-time-display empty">--:-- – --:--</div>`;
            } else if (saved.status === 'holiday') {
                middleHtml = `<div class="day-status-note">🎉 ${holidayName || 'Feiertag'}</div>`;
            } else if (saved.status === 'vacation' || saved.status === 'sick') {
                middleHtml = `<div class="day-status-note">Soll gutgeschrieben</div>`;
            } else middleHtml = `<div class="day-status-note">${(isSaturday || isSunday) ? 'Wochenende (frei)' : 'Gleitzeitabbau'}</div>`;

            row.innerHTML = `<div class="day-label"><strong>${dayShort[i]}</strong><span>${dateShort}${smokeSub}${splitSub}${finalSub}</span></div>${middleHtml}<div class="status-badge-pill" data-status="${saved.status}">${statusLabels[saved.status] || 'Arbeit'}</div>`;
            row.addEventListener("click", () => openDayEditor(dateStr, `${dayFullNames[i]}, ${dateShort}${currDate.getFullYear()}`, isSaturday ? 'work' : defaultStatus));
            container.appendChild(row);

            if (saved.status === 'work') {
                if (dateStr === todayStr && !saved.dayFinalized) weekHasLiveToday = true;
                else weekStaticCreditedSecs += getDayBreakdown(saved, null).netSecs;
            } else if (saved.status === 'vacation' || saved.status === 'sick' || saved.status === 'holiday') {
                weekStaticCreditedSecs += sollSecsPerDay;
            }
        }
        renderWeekSummaryLive();
    }

    if (typeof mods.initPdfExportModal === "function") {
        mods.initPdfExportModal({
            format2,
            getWeekOffset: () => weekOffset,
            getUserName: () => userName,
            setUserName: (val) => { userName = val; },
            userNameInput,
            getSollHours: () => sollHours,
            getSollMinutes: () => sollMinutes,
            getHolidayName,
            getDayData,
            getDayBreakdown,
            statusLabels,
            exportBackupJson
        });
    }

    /* =========================================================
       VIER-WEGE-WISCHSTEUERUNG ÜBERALL (ORB-GESCHÜTZT)
       ========================================================= */
    const pdfExportModal = document.getElementById("pdf-export-modal");
    let touchStartX = 0, touchStartY = 0, touchBlocked = false, stageScrollAtStart = 0;

    document.addEventListener("touchstart", (e) => {
        const anyModalOpen = dayEditorModal.classList.contains("active")
            || (pdfExportModal && pdfExportModal.classList.contains("active"))
            || backfillModal.classList.contains("active");

        if (!gesturesEnabled
            || anyModalOpen
            || isOrbGestureProtected()
            || e.touches.length !== 1
            || e.target.closest("#btn-welcome-action, canvas, input, select, textarea, #custom-keypad-sheet, #kw-merged-swipebar")) {
            touchBlocked = true;
            return;
        }
        touchBlocked = false;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        stageScrollAtStart = viewsStage.scrollTop;
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
        if (!gesturesEnabled || touchBlocked || isOrbGestureProtected() || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const absX = Math.abs(dx), absY = Math.abs(dy);
        const threshold = 55;

        if (absX > threshold && absX > absY * 1.3) {
            if (welcomeOverlay.classList.contains("active")) {
                if (dx < 0) switchToWeekView();
                else closeWelcomeScreen();
            } else if (viewClock.classList.contains("active")) {
                if (dx < 0) switchToWeekView();
                else openSettingsMenu();
            } else if (viewWeek.classList.contains("active")) {
                if (dx > 0) switchToClockView();
                else openSettingsMenu();
            } else if (viewMenu.classList.contains("active")) {
                if (dx > 0) switchToWeekView();
                else switchToClockView();
            }
            return;
        }

        if (absY > threshold && absY > absX * 1.3) {
            const scrolledDuringSwipe = Math.abs(viewsStage.scrollTop - stageScrollAtStart) > 12;
            const maxScroll = Math.max(0, viewsStage.scrollHeight - viewsStage.clientHeight);

            if (dy < 0) {
                if (!welcomeOverlay.classList.contains("active")) {
                    if (!scrolledDuringSwipe && ((maxScroll - stageScrollAtStart) <= 10 || maxScroll <= 4)) {
                        openWelcomeScreen();
                    }
                }
            } else {
                if (!scrolledDuringSwipe && (welcomeOverlay.classList.contains("active") || stageScrollAtStart <= 2)) {
                    openSettingsMenu();
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
            } else localStorage.removeItem("savedTodaySessions");
        }
    } catch (e) { localStorage.removeItem("savedTodaySessions"); }

    welcomeActionMode = getLogicalNextMode();
    syncActionButtonVisuals();
    updateStampStatusUI();
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
        if (pS && !pE && !todayFinalized) {
            checkPauseNotifications();
            updateWelcomeWidgets();
            if (viewClock.classList.contains("active")) {
                calculateWorkingTime();
                if (todaySessions.length > 1) {
                    const { totalPresSecs } = getSessionMetrics(getNowSecsOfDay());
                    sessionsPresSum.textContent = `Anwesenheit: ${format2(Math.floor(totalPresSecs / 3600))}:${format2(Math.floor((totalPresSecs % 3600) / 60))} h`;
                }
            }
        } else updateWelcomeWidgets();

        if (viewWeek.classList.contains("active") && weekHasLiveToday) renderWeekSummaryLive();
    }

    document.addEventListener("visibilitychange", () => { if (!document.hidden) tickLiveEngine(); });

    document.addEventListener("pointerdown", (e) => {
        if (!("vibrate" in navigator)) return;
        const target = e.target.closest("button, .kg-pill, .week-row, .settings-nav-card, .section-accordion-btn, .scribble-svg-chip, .day-status-chip, .widget-mode-pill, .icon-variant-card, .kp-key");
        if (target && !target.disabled) {
            try { navigator.vibrate(6); } catch (err) {}
        }
    }, { passive: true });

    tickLiveEngine();
    setInterval(tickLiveEngine, 1000);
});