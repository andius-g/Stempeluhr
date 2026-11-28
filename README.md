# ⏱️ Stempeluhr & Wochenübersicht (v2.0.0)

Eine schlanke, offline-fähige **Progressive Web App (PWA)** zur Erfassung von Arbeitszeiten, Pausen, Gleitzeitsaldo und Monatsnachweisen – optimiert für Smartphone-Touch-Bedienung und statisches Hosting (z. B. GitHub Pages).

---

## ✨ Highlights in Version 2.0.0

- **4-Wege-Wischsteuerung & Start-Screen:**
  - Direkter Einstieg über den **Start-Screen** mit personalisierter Begrüßung, animierten Hintergrund-Scribbles (32 Motive) und prominentem **Kommen/Gehen-Button im Goldenen Schnitt ($\varphi \approx 1{,}618$)**.
  - **Status-Kachel** mit sofortiger Übersicht (*Eingestempelt*, *Ausgestempelt*, *Tag final abgeschlossen*) inklusive Zeitstempel.
  - **Finaler Feierabend:** Schalter auf dem Gehen-Screen, um den Arbeitstag bewusst als beendet zu markieren.
  - **Live-Widgets auf dem Start-Screen:**
    - *Sollzeit-Pille:* Berechnet die exakte Ziel-Uhrzeit für $\pm 0$ unter Berücksichtigung gesetzlicher Pausen ($30\text{ min}$ ab $06{:}30\text{ h}$ und $45\text{ min}$ ab $09{:}45\text{ h}$ Anwesenheit), Raucherpausen sowie Unterbrechungen zwischen Zeitblöcken.
    - *Pausenwächter:* Live-Countdown bis zur 30-Minuten- und 45-Minuten-Pausengrenze.
- **Tagesansicht („Uhr“):**
  - Ein-Klick-Stempeln für **Kommen** und **Gehen** sowie **Undo-Funktion** für die letzten 20 Aktionen.
  - Unterstützung mehrerer Zeitblöcke pro Tag inklusive automatischer Berechnung von Abwesenheits-Unterbrechungen.
  - Optionale **Raucherpausen-Erfassung** (wird mit dem gesetzlichen Pausenabzug verrechnet).
  - Ruhige **4-stellige Links-nach-Rechts-Zeiteingabe** (`hh:mm`) über eine eigene App-Zahlentastatur oder wahlweise die System-Tastatur.
- **Wochenübersicht („Woche“) & GLZ-Ampelkonto:**
  - Kompakte Wochenansicht (Mo–Sa, So bei Buchung) mit Kalenderwochen-Navigation, Datums-Sprung und einheitlichem Tages-Editor (`hh:mm`, Status: *Arbeit*, *Urlaub*, *Krank*, *Feiertag*, *Frei*).
  - **Feiertagserkennung** für Niedersachsen (2026–2028).
  - **GLZ-Ampelkonto (GBV § 5):** Automatische Berechnung des Gesamtsaldos mit Ampelstatus (*Grün*, *Gelb*, *Rot*) skaliert auf die vertraglichen Wochenstunden.
- **Menü & Individualisierung:**
  - Platzsparende **Einzel-Akkordeons** in allen Untermenüs (*Arbeitszeit & Pausen*, *Widgets & Tastatur*, *Darstellung & Design*).
  - Stufenloses **Farbrad** (Komplementär-Harmonie), **Klassisches oder Asymmetrisches Form-Design**, **App-Icon-Wahl** (*Blau/Cyan* oder *Rosé/Berry*) und optionale **Push-Vorwarnungen** vor Pausengrenzen.
- **Offline-Fähigkeit, Backup & PDF-Export:**
  - Vollständig offline lauffähig über Service Worker (`sw.js`) – alle Daten bleiben lokal im `localStorage` des Browsers.
  - **JSON-Backup & Wiederherstellung** sowie **DIN-A4-Monats-PDF-Export** inkl. Unterschriftszeilen.

---

## 📁 Dateistruktur

```text
├── index.html            # Hauptstruktur, Screens, Modals & Inline-Theme-Bootstrap
├── styles.css            # Layout, Farbharmonie, Asymmetrie-Variablen & Akkordeons
├── app.js                # Kernlogik (Stempeln, Pausen, GLZ-Ampel, Tastatur, Gesten)
├── scribbles.js          # Modul: 32 SVG-Hintergrundmotive für den Start-Screen
├── holidays-nds.js       # Modul: Gesetzliche Feiertage (Niedersachsen, 2026–2028)
├── pdf-export.js         # Modul: DIN-A4-Monatsübersicht via jsPDF
├── sw.js                 # Service Worker für Offline-Caching
├── manifest.json         # PWA-Manifest (Blau / Cyan)
├── manifest-rose.json    # PWA-Manifest (Rosé / Berry)
└── favicon*.png          # App-Icons in verschiedenen Größen und Farbvarianten
```

---

## 🚀 Installation & Nutzung

1. **Hosting:** Alle Dateien in ein statisches Webverzeichnis oder ein **GitHub-Pages**-Repository legen (kein Build-Step oder Backend erforderlich).
2. **Auf dem Smartphone installieren:**
   - Seite im mobilen Browser (Chrome/Edge auf Android, Safari auf iOS) öffnen.
   - Optional im Menü unter *Darstellung & Design → App-Icon* die gewünschte Icon-Farbe wählen.
   - Über das Browser-Menü **„App installieren“** bzw. **„Zum Home-Bildschirm“** hinzufügen.
3. **Update erzwingen:** Bei neuen Versionen kann im Menü unten über **„↻ Update erzwingen“** (oder durch 3 Sekunden langes Gedrückthalten der Live-Uhr oben links) der Service-Worker-Cache geleert und neu geladen werden.

---

## 🔒 Datenschutz

Alle gestempelten Zeiten, Einstellungen und Salden werden ausschließlich lokal auf deinem Gerät (`localStorage`) gespeichert. Es findet keinerlei Übertragung an externe Server statt; lediglich `jsPDF` wird für den PDF-Export über CDN geladen und anschließend im Service Worker zwischengespeichert.