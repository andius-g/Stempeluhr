/* =========================================================
   STEMPELUHR — FEIERTAGE NIEDERSACHSEN (MODUL)
   ========================================================= */
window.StempeluhrModules = window.StempeluhrModules || {};

window.StempeluhrModules.holidaysNds = {
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

window.StempeluhrModules.getHolidayName = function(dateStr) {
    return window.StempeluhrModules.holidaysNds[dateStr] || null;
};