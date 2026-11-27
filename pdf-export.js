/* =========================================================
   STEMPELUHR — MONATS-PDF-EXPORT (MODUL)
   ========================================================= */
window.StempeluhrModules = window.StempeluhrModules || {};

window.StempeluhrModules.initPdfExportModal = function(ctx) {
    const {
        format2,
        getWeekOffset,
        getUserName,
        setUserName,
        userNameInput,
        getSollHours,
        getSollMinutes,
        getHolidayName,
        getDayData,
        getDayBreakdown,
        statusLabels,
        exportBackupJson
    } = ctx;

    const pdfExportModal = document.getElementById("pdf-export-modal");
    const pdfMonthSelect = document.getElementById("pdfMonthSelect");
    const pdfUserNamePreview = document.getElementById("pdfUserNamePreview");
    const pdfAlsoBackupCheck = document.getElementById("pdfAlsoBackupCheck");

    if (!pdfExportModal || !pdfMonthSelect || !pdfUserNamePreview) return;

    document.getElementById("btn-open-pdf-modal").addEventListener("click", () => {
        const refDate = new Date();
        refDate.setDate(refDate.getDate() + (getWeekOffset() * 7));
        pdfMonthSelect.value = `${refDate.getFullYear()}-${format2(refDate.getMonth() + 1)}`;
        pdfUserNamePreview.value = getUserName();
        pdfExportModal.classList.add("active");
    });

    document.getElementById("btn-close-pdf-modal").addEventListener("click", () => {
        pdfExportModal.classList.remove("active");
    });

    document.getElementById("btn-download-month-pdf").addEventListener("click", () => {
        if (!pdfMonthSelect.value) return;
        const currentUserName = getUserName();
        const enteredName = pdfUserNamePreview.value.trim();
        if (enteredName !== currentUserName) {
            setUserName(enteredName);
            if (userNameInput) userNameInput.value = enteredName;
            localStorage.setItem("userName", enteredName);
        }
        if (!window.jspdf || !window.jspdf.jsPDF) {
            alert("PDF-Bibliothek konnte offline nicht geladen werden. Bitte einmal mit Internet öffnen.");
            return;
        }

        const sollHours = getSollHours();
        const sollMinutes = getSollMinutes();
        const activeUserName = getUserName();

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
        doc.text(`Mitarbeiter: ${activeUserName || "__________________________"}`, 14, 24);
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

        const safeName = (activeUserName || "Stundenzettel").replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
        doc.save(`Stundenzettel_${yearNum}-${format2(monthNum)}_${safeName}.pdf`);

        if (pdfAlsoBackupCheck && pdfAlsoBackupCheck.checked && typeof exportBackupJson === "function") {
            setTimeout(exportBackupJson, 450);
        }
        pdfExportModal.classList.remove("active");
    });
};