# Task-Liste: Umsetzung RecordFox

Diese Liste enthält alle notwendigen Arbeitsschritte zur vollständigen Realisierung der Desktop-App. Die Tasks sind chronologisch nach Abhängigkeiten sortiert.

---

## Phase 1: Projekt-Setup & Infrastruktur

- [x] **1.1 Electron + React Setup**
  - [x] Projekt mit Electron-Forge, Vite, React und TypeScript initialisieren.
  - [x] Ordnerstruktur festlegen (`src/main`, `src/renderer`, `src/preload`).
- [x] **1.2 Styling & UI-Bibliotheken**
  - [x] Tailwind CSS im Renderer konfigurieren.
  - [x] shadcn/ui konfigurieren und Basiskomponenten installieren (Button, Input, Dialog, Table, Slider, Dropdown-Menu, Progress).
  - [x] Lucide-React Icons einbinden.
- [x] **1.3 Datenbank & Dateisystem-Setup**
  - [x] Lokale Speicherverzeichnisse im User-Verzeichnis (`Application Support`) erstellen.
  - [x] SQLite Datenbank (`better-sqlite3` oder dateibasierte Store-Lösung) einrichten.
  - [x] DB-Tabellen definieren: `playlists` (id, title, url, sync_status, last_sync) und `tracks` (id, playlist_id, title, artist, bpm, duration, filepath, youtube_id, cover_path).

---

## Phase 2: Main-Prozess & Background-Bibliotheken

- [x] **2.1 Integration von yt-dlp & FFmpeg**
  - [x] Helper-Skript zum Ermitteln/Herunterladen der passenden `yt-dlp` und `ffmpeg` Binaries für das jeweilige OS (macOS Intel/M-Chips).
  - [x] Wrapper-Funktionen für `yt-dlp` zum Auslesen von Playlist-Metadaten (`--dump-json`) und Herunterladen von Audio.
- [x] **2.2 Metadaten- & BPM-Analyse-Pipeline**
  - [x] Integration von `node-id3` zum Schreiben the ID3-Metadaten.
  - [x] Download und temporäres Speichern von Cover-Thumbnails.
  - [x] Implementierung der BPM-Erkennungsfunktion in Node.js (Audio dekodieren und Peak-Erkennung durchführen).
  - [x] Parsing-Logik schreiben, um Interpret und Titel zuverlässig aus dem Video-Titel zu trennen (z. B. durch RegExp wie `Artist - Title`).

---

## Phase 3: Synchronisations- & Download-Engine (Main-Prozess)

- [x] **3.1 Download-Queue & Status-IPC**
  - [x] Asynchronen Queue-Manager implementieren, der Downloads nacheinander abarbeitet.
  - [x] IPC-Event-Handler schreiben, um dem Renderer den aktuellen Download-Status zu senden (z. B. Fortschritt in Prozent).
- [x] **3.2 Sync-Manager & Cron-Job**
  - [x] Synchronisations-Logik schreiben: Playlist-Inhalt bei YouTube abfragen, mit DB abgleichen, neue Tracks in Queue einreihen und verwaiste Tracks löschen.
  - [x] Cron-Timer-Interval (z. B. alle 30 Min) im Main-Prozess registrieren, um alle aktiven Playlists automatisch zu synchronisieren.

---

## Phase 4: Frontend (Renderer-Prozess) - UI-Layout

- [x] **4.1 Haupt-Layout (Sidebar + Main)**
  - [x] Responsive 3-Spalten-Layout (Sidebar, Trackliste, DJ-Mixer).
  - [x] Sidebar: Liste der Playlists mit Covern, Add-Playlist-Button, Sync-Indikatoren.
  - [x] Modaler Dialog "Playlist hinzufügen" mit Validierung der YouTube-URL.
- [x] **4.2 Trackliste**
  - [x] Tabelle mit Tracks der ausgewählten Playlist (Cover, Title, Interpret, BPM, Dauer).
  - [x] Such- und Sortierfunktion für Tracks (nach Titel, Interpret, BPM).
  - [x] Kontextmenü/Aktions-Buttons: "In Deck A laden", "In Deck B laden".

---

## Phase 5: DJ-Mixer & Player (Renderer-Prozess)

- [x] **5.1 Web Audio API Basis-Integration**
  - [x] Globalen AudioContext initialisieren.
  - [x] Audio-Graphen pro Deck erstellen (SourceNode -> PitchNode -> BiquadFilter EQ -> Fader -> Master -> Destination).
- [x] **5.2 Dual-Deck Steuerung**
  - [x] Play, Pause und Stop für Deck A und Deck B.
  - [x] Cue-Punkt-Logik (Setzen/Springen).
  - [x] Pitch-Control: Slider zur Anpassung der Abspielgeschwindigkeit (±16%) unter Erhaltung der Tonhöhe (preservesPitch = true).
- [x] **5.3 Mixer-Sektion**
  - [x] 3-Band EQ Knobs für Höhen, Mitten, Tiefen pro Deck.
  - [x] Kanalfader und ein globaler Crossfader zur Überblendung zwischen Deck A und B.
- [x] **5.4 Looping & Takt-Synchronisation**
  - [x] Loop-In & Loop-Out Steuerung.
  - [x] Beat-Loop Tasten (1, 2, 4, 8, 16 Beats) – nutzt die BPM des Tracks für die Zeitberechnung.
- [x] **5.5 Waveform-Visualisierung**
  - [x] Rendern der Wellenform auf einem Canvas durch Vorab-Dekodierung der geladenen Audiodatei (AudioBuffer).
  - [x] Scrolling-Waveform-Animation während der Wiedergabe (Spur bewegt sich an einer vertikalen Markierungslinie vorbei).

---

## Phase 6: Qualitätssicherung & Polishing

- [x] **6.1 UI/UX Polishing**
  - [x] Premium-Aesthetics implementieren (Glassmorphismus, sanfte Hover-Effekte, edle Farbverläufe).
  - [x] Drag-and-Drop Unterstützung: Ziehen eines Tracks aus der Liste direkt auf Deck A oder B.
- [x] **6.2 Error-Handling & Logging**
  - [x] Robuste Behandlung von ungültigen/privaten YouTube-URLs.
  - [x] Fehler-Logbuch für fehlgeschlagene Downloads oder Konvertierungen.
- [x] **6.3 Integrationstests & App-Packaging**
  - [x] Manuelles Testen des vollständigen Sync- und DJ-Workflows.
  - [x] Build-Prozess konfigurieren (Electron Builder), um ein lauffähiges `.dmg` für macOS zu erzeugen.

---

## Phase 7: Einstellungen & Poti-Drehregler (Erweiterung)

- [x] **7.1 Datenbank-Erweiterung für Einstellungen & Metadaten**
  - [x] Einstellungen-Schema (Theme, DownloadPath, SidebarWidth) in `db.ts` definieren.
  - [x] Track-Schema erweitern um `filesize`, `format` und `rating` (0 bis 5).
  - [x] Persistente Lade- und Schreibfunktionen für Einstellungen bereitstellen.
- [x] **7.2 Main-Prozess IPC & Pfad-Migration**
  - [x] IPC-Handler `settings:get` und `settings:update` registrieren.
  - [x] IPC-Handler `dialog:select-directory` und `dialog:confirm-migration` via Electron-Dialog implementieren.
  - [x] Physische Dateimigrations-Logik in `db.ts` schreiben (verschieben der Dateien und Pfadanpassung in der DB).
  - [x] IPC-Handler `tracks:update-rating` zum Aktualisieren des Ratings in DB und Schreiben des ID3 POPM-Tags.
- [x] **7.3 Custom Poti-Komponente (Knob)**
  - [x] Reusable React `<Knob />`-Komponente mit SVG-Anzeige und Maus-Drag-Steuerung implementieren.
  - [x] Doppelklick-Reset-Funktion auf 0dB einbauen.
- [x] **7.4 Drag & Drop für Decks & Column Resizer**
  - [x] Native HTML5 Drag-and-Drop Handlers an Tabellenzeilen (Tracklist) und Decks implementieren.
  - [x] Draggable Divider (Splitter) zwischen Sidebar und Tracklist für Spaltenbreite integrieren.
  - [x] Breite im Layout anwenden und persistent über Settings abspeichern.
- [x] **7.5 Mixer-Anpassung, Light-Mode & Metadaten-View**
  - [x] EQs im Mixer auf Drehregler (Knob) umstellen.
  - [x] Spalten für Dateigröße, Format und Sterne-Bewertung in die `Tracklist.tsx` Tabelle einbauen.
  - [x] CSS-Variablen für Light-Mode und Übergänge in `main.css` definieren.
  - [x] Modales Einstellungsfenster (`SettingsModal.tsx`) mit Speicherpfad-Änderung und Light/Dark-Toggle implementieren.
  - [x] Einstellungs-Zahnrad in Sidebar einbinden und Settings-State in `App.tsx` verknüpfen.
  - [x] Anzeige des letzten Synchronisations-Datums UND der Uhrzeit (Format: DD.MM.YYYY HH:MM) in der Playlist-Sidebar implementieren.
