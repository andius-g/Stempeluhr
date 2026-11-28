/* =========================================================
   STEMPELUHR — BEGRÜSSUNGS- & VERABSCHIEDUNGSSPRÜCHE (MODUL)
   ========================================================= */
window.StempeluhrModules = window.StempeluhrModules || {};

window.StempeluhrModules.PHRASES = {
    greeting: [
        "Guten Morgen, [Name]!",
        "Hallo [Name]!",
        "Moin [Name]!",
        "Servus [Name]!",
        "Bonjour, [Name]!",
        "Hola [Name]!",
        "Ciao [Name]!",
        "Good morning, [Name]!",
        "Salut, [Name]!",
        "Aloha [Name]!",
        "Hi [Name]!",
        "Hey [Name]!",
        "Willkommen zurück, [Name]!",
        "Schön, dass du da bist, [Name]!",
        "Grüß dich, [Name]!",
        "Guten Tag, [Name]!",
        "Moin moin, [Name]!",
        "Auf geht's, [Name]!",
        "Gut, dass du hier bist, [Name]!",
        "Hallöchen, [Name]!",
        "Schönen guten Morgen, [Name]!",
        "Endlich da, [Name]!",
        "Guten Start, [Name]!",
        "Grüß Gott, [Name]!",
        "Tagchen, [Name]!",
        "Na, [Name]!",
        "Schau an, [Name]!",
        "Hallo zurück, [Name]!",
        "Schönen Tag, [Name]!",
        "Morgen, [Name]!",
        "Willkommen, [Name]!",
        "Sehr schön, [Name]!",
        "Schön, dich zu sehen, [Name]!",
        "Moin zusammen, [Name]!",
        "Da bist du ja, [Name]!",
        "Einen guten Morgen, [Name]!",
        "Herzlich willkommen, [Name]!",
        "Schönen Vormittag, [Name]!",
        "Gut gestartet, [Name]!",
        "Na du, [Name]!",
        "Welcome back, [Name]!",
        "Buon giorno, [Name]!",
        "Hej [Name]!",
        "Namaste, [Name]!",
        "Grüezi, [Name]!",
        "Hallihallo, [Name]!",
        "Tag, [Name]!",
        "Schönen Tag dir, [Name]!",
        "Moin, [Name]!",
        "Guten Morgen zusammen, [Name]!"
    ],
    farewell: [
        "Tschüss [Name]!",
        "Ciao [Name]!",
        "Bye-bye, [Name]!",
        "See you, [Name]!",
        "Au revoir, [Name]!",
        "Adiós, [Name]!",
        "Hasta la vista, [Name]!",
        "Arrivederci, [Name]!",
        "Take care, [Name]!",
        "Good bye, [Name]!",
        "Tschau [Name]!",
        "Mach's gut, [Name]!",
        "Bis morgen, [Name]!",
        "Schönen Feierabend, [Name]!",
        "Gute Heimreise, [Name]!",
        "Bis bald, [Name]!",
        "Adieu [Name]!",
        "Komm gut heim, [Name]!",
        "Bis zum nächsten Mal, [Name]!",
        "Hab einen schönen Abend, [Name]!",
        "Bis dann, [Name]!",
        "Alles Gute, [Name]!",
        "Bis später, [Name]!",
        "Schönen Abend, [Name]!",
        "Erhol dich gut, [Name]!",
        "Bis die Tage, [Name]!",
        "Gute Fahrt, [Name]!",
        "Schönes Wochenende, [Name]!",
        "Gut erholen, [Name]!",
        "Bis neulich, [Name]!",
        "Bis Montag, [Name]!",
        "Tschüssikowski, [Name]!",
        "Komm gut an, [Name]!",
        "Bis demnächst, [Name]!",
        "Auf Wiedersehen, [Name]!",
        "Schönen Resttag, [Name]!",
        "Tschau mit au, [Name]!",
        "Gute Heimfahrt, [Name]!",
        "Bis morgen früh, [Name]!",
        "Servus, [Name]!",
        "Pfüati, [Name]!",
        "Ade, [Name]!",
        "So long, [Name]!",
        "Farewell, [Name]!",
        "Salut, [Name]!",
        "Hasta luego, [Name]!",
        "A bientôt, [Name]!",
        "Hej då, [Name]!",
        "Tot ziens, [Name]!",
        "Sayonara, [Name]!"
    ]
};

window.StempeluhrModules.getPhrasePool = function(direction) {
    const dir = direction === "farewell" ? "farewell" : "greeting";
    return (window.StempeluhrModules.PHRASES && window.StempeluhrModules.PHRASES[dir]) || [];
};

window.StempeluhrModules.formatPhraseText = function(rawPhrase, rawName) {
    const template = String(rawPhrase || "").trim();
    if (!template) return "";
    const cleanName = (rawName || "").trim() || "Amici";
    return template.replace(/\[Name\]/g, cleanName);
};

window.StempeluhrModules.getRotatedPhrase = function(direction, rawName) {
    const pool = window.StempeluhrModules.getPhrasePool(direction);
    if (!pool.length) return "";

    const dir = direction === "farewell" ? "farewell" : "greeting";
    const storageKey = `phraseIdx_${dir}`;
    let lastIdx = NaN;
    try {
        lastIdx = parseInt(localStorage.getItem(storageKey), 10);
    } catch (e) {}
    const nextIdx = isNaN(lastIdx) ? 0 : ((lastIdx + 1) % pool.length);
    try {
        localStorage.setItem(storageKey, String(nextIdx));
    } catch (e) {}

    return window.StempeluhrModules.formatPhraseText(pool[nextIdx], rawName);
};