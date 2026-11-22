# Stempeluhr & Wochenübersicht (PWA) – Version 1.7

Eine schlanke, offlinefähige Single-Page-Web-App (PWA) zur privaten Arbeitszeiterfassung auf dem Smartphone. Alle Stempelzeiten, Einstellungen und Salden bleiben lokal im `localStorage` des Browsers gespeichert – ohne Cloud-Zwang oder Tracking.

## Neu in Version 1.7
- **Trennung in `index.html`, `styles.css` und `app.js`:** Übersichtliche Aufteilung von Struktur, Gestaltung und Anwendungslogik bei gleichbleibender Offline-Caching-Unterstützung in `sw.js`.
- **Vier getrennte Tasten in der unteren Tastaturreihe:** Unten liegen eigenständige Tasten für **`,`**, **`0`**, **`.`** und **`↵`** – global nutzbar auf der Uhr, im Menü sowie im Tages-Editor.

## Hauptfunktionen
- **Startbildschirm (Kommen / Gehen):** Vollbild-Schnellstempelung beim Öffnen mit konfigurierbaren Hintergrund-Scribbles (32 Motive) und Wischsteuerung in alle 4 Richtungen.
- **Tages-Uhr & Pausenrechner:**
  - Ein-Klick-Stempeln (**Kommen** / **Gehen**) inkl. Rückgängig-Funktion (`Undo`) und Unterstützung mehrerer Zeitblöcke pro Tag.
  - Automatische Berechnung der gesetzlichen Pausengrenzen (**6:30 Std → 30 Min**, **9:45 Std → 45 Min**) sowie optionaler **Raucherpausen** und **Push-Vorwarnungen**.
  - Manuelle Zeitkorrektur über die **K/G-Pillen** mit automatischer `hh:mm`-Formatierung.
- **Wochenansicht & Ampelkonto:**
  - Übersicht von Montag bis Samstag (Sonntag erscheint automatisch bei Buchung) inklusive Feiertagen für Niedersachsen[span_0](start_span)[span_0](end_span).
  - Komfortable KW-Wischleiste sowie Tages-Editor zum Nachbearbeiten einzelner Tage und Status (*Arbeit*, *Urlaub*, *Krank*, *Feiertag*, *Frei*).
  - Gleitzeit-Ampel (`GLZ`) auf Basis von Startsaldo, Stichtag und vertraglicher Wochenstunden.
- **Darstellung & Design:**
  - Triadisches Farbrad (120°) mit Helligkeitsregler sowie *Klassisch* und *Asymmetrisch & Organisch* inklusive Intensitätsregler.
- **Datensicherung & Monats-PDF:**
  - JSON-Backup (Export und Import des gesamten `localStorage`).
  - DIN-A4-Monatsübersicht als PDF (via `jsPDF`) mit optionalem JSON-Backup direkt im Anschluss.

## Dateistruktur im Repository
- `index.html` – Grundgerüst, Modals und Startbildschirm
- `styles.css` – Design-Variablen, Layouts und Komponenten-Styles
- `app.js` – Zeitberechnung, Wochenlogik, Ampelkonto, PDF-Export und globale Tastatur
- `sw.js` – Service Worker für Offline-Cache (`stempeluhr-cache-v1.7`) und Benachrichtigungen
- `manifest.json` – PWA-Manifest
- `favicon.png` – App- und Benachrichtigungs-Icon