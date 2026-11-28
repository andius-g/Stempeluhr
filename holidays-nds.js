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
    if (window.StempeluhrModules.holidaysNds[dateStr]) {
        return window.StempeluhrModules.holidaysNds[dateStr];
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) return null;
    const year = Number(m[1]);
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const mVal = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * mVal + 114) / 31);
    const day = ((h + l - 7 * mVal + 114) % 31) + 1;
    const easter = new Date(Date.UTC(year, month - 1, day));
    const shift = (offset) => new Date(easter.getTime() + offset * 86400000).toISOString().slice(0, 10);
    const dyn = {
        [`${year}-01-01`]: "Neujahr",
        [shift(-2)]: "Karfreitag",
        [shift(1)]: "Ostermontag",
        [`${year}-05-01`]: "Tag der Arbeit",
        [shift(39)]: "Christi Himmelfahrt",
        [shift(50)]: "Pfingstmontag",
        [`${year}-10-03`]: "Tag d. Dt. Einheit",
        [`${year}-10-31`]: "Reformationstag",
        [`${year}-12-25`]: "1. Weihnachtstag",
        [`${year}-12-26`]: "2. Weihnachtstag"
    };
    return dyn[dateStr] || null;
};