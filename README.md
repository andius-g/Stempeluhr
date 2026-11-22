# Stempeluhr & Wochenübersicht (PWA) – Version 1.6

Eine schlanke, offlinefähige Single-Page-Web-App (PWA) zur privaten Arbeitszeiterfassung auf dem Smartphone. Alle Stempelzeiten, Einstellungen und Salden bleiben lokal im `localStorage` des Browsers gespeichert – ohne Cloud-Zwang oder Tracking.

## Neu in Version 1.6
- **Globale Zahlentastatur:** Alle Zahlen- und Zeitfelder in der gesamten App (die **K/G-Pillen** auf der Uhr, sämtliche **Zahlenfelder im Menü** sowie die **Stunden- und Minutenfelder im Tages-Editor**) nutzen einheitlich die integrierte App-Zahlentastatur statt der Systemtastatur.
- **Taste `,0.`:** Unten links auf der Zahlentastatur steht das Symbol `,0.` (Komma, Null, Punkt) für Dezimalwerte (z. B. GLZ-Startsaldo) bzw. Null-Ergänzung.

## Hauptfunktionen
- **Startbildschirm (Kommen / Gehen):** Vollbild-Schnellstempelung beim Öffnen mit konfigurierbaren Hintergrund-Scribbles (32 Motive) und Wischsteuerung in alle 4 Richtungen.
- **Tages-Uhr & Pausenrechner:**
  - Ein-Klick-Stempeln (**Kommen** / **Gehen**) inkl. Rückgängig-Funktion (`Undo`) und Unterstützung mehrerer Zeitblöcke pro Tag.
  - Automatische Berechnung der gesetzlichen Pausengrenzen (**6:30 Std → 30 Min**, **9:45 Std → 45 Min**) sowie optionaler **Raucherpausen** und **Push-Vorwarnungen**.
  - Manuelle Zeitkorrektur über die **K/G-Pillen** mit automatischer `hh:mm`-Formatierung.
- **Wochenansicht & Ampelkonto:**
  - Übersicht von Montag bis Samstag (Sonntag erscheint automatisch bei Buchung) inklusive Feiertagen für Niedersachsen.
  - Komfortable KW-Wischleiste sowie Tages-Editor zum Nachbearbeiten einzelner Tage.
  - Integriertes **GLZ-Ampelkonto** (Grün / Gelb / Rot) mit frei wählbarem Startsaldo und Stichtag.
- **Export & Datensicherung:**
  - Druckfertiger **DIN-A4-Monatsstundenzettel als PDF** (`jsPDF`).
  - Vollständiger **JSON-Backup-Export & -Import** zur Sicherung oder Übertragung auf ein anderes Gerät.

## Installation & Hosting (GitHub Pages)
1. Die vier Dateien (`index.html`, `sw.js`, `manifest.json`, `favicon.png`) im Root-Verzeichnis des Repositories ablegen.
2. In GitHub unter **Settings → Pages** den Branch (`main`) auswählen.
3. Die URL im mobilen Browser öffnen und über **„Zum Startbildschirm hinzufügen“** als PWA installieren.