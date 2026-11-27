/* =========================================================
   STEMPELUHR — 32 SCRIBBLE-SVG-MOTIVE (MODUL)
   ========================================================= */
window.StempeluhrModules = window.StempeluhrModules || {};

window.StempeluhrModules.SCRIBBLE_ICONS = [
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

window.StempeluhrModules.makeScribbleSvg = function(iconObj) {
    return `<svg viewBox="0 0 36 36">${iconObj.inner}</svg>`;
};