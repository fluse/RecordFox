# Konzept: RecordFox (Desktop-App)

Dieses Dokument beschreibt das technische und gestalterische Konzept für **RecordFox**, eine macOS-Desktop-Anwendung zur Synchronisation von YouTube-Playlists und zum Abspielen der Musiktitel in einem DJ-Mix-Player.

---

## 1. Übersicht & Zielsetzung

Die App ermöglicht es Benutzern, öffentliche YouTube-Playlists hinzuzufügen. Diese werden automatisch als hochqualitative MP3-Dateien heruntergeladen und lokal gespeichert. Ein Hintergrund-Cron-Job (bzw. ein regelmäßiger Sync-Interval) hält die lokalen Dateien mit den YouTube-Playlists synchron (lädt neue Titel herunter, entfernt gelöschte Titel). Die heruntergeladenen MP3s werden mit Metadaten (Titel, Interpret, Album, Coverbild, BPM) versehen. Ein integrierter DJ-Mix-Player erlaubt das Abspielen, Pitchen, Equalisieren und Loopen der Tracks.

---

## 2. Systemarchitektur und Technologie-Stack

Die Anwendung wird als native Desktop-Applikation auf Basis von **Electron** realisiert.

```
┌────────────────────────────────────────────────────────┐
│                   Renderer-Prozess                     │
│               (React + Tailwind + shadcn/ui)           │
│                                                        │
│   ┌──────────────────┐          ┌──────────────────┐   │
│   │   DJ-Interface   │          │  Playlist-View   │   │
│   └────────┬─────────┘          └────────┬─────────┘   │
│            │                             │             │
│            └──────────────┬──────────────┘             │
│                           ▼                             │
│                  Web Audio API / Canvas                │
└───────────────────────────┬────────────────────────────┘
                            │ IPC-Kanal (Inter-Process)
                            ▼
┌────────────────────────────────────────────────────────┐
│                     Main-Prozess                       │
│                     (Node.js + Electron)               │
│                                                        │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────┐  │
│  │ Download Mgr   │ │ Sync-Cron      │ │ Database   │  │
│  │ (yt-dlp/ffmpeg)│ │ (Interval Jobs)│ │ (SQLite)   │  │
│  └────────┬───────┘ └────────────────┘ └────────────┘  │
│           │                                            │
│           ▼                                            │
│  ┌────────────────┐                                    │
│  │ BPM-Analyzer   │                                    │
│  │ & ID3-Writer   │                                    │
│  └────────────────┘                                    │
└────────────────────────────────────────────────────────┘
```

### Tech-Stack im Detail:
1. **Framework:** Electron (für OS-Integration) + React (für das Frontend).
2. **Sprache:** TypeScript (für Renderer und Main).
3. **Styling:** CSS3, Tailwind CSS und **shadcn/ui** für ein modernes, konsistentes und hochwertiges UI-Design.
4. **Datenbank:** SQLite (`better-sqlite3` oder simple persistente JSON-Datenbank wie `lowdb`) zur Speicherung der Playlist- und Track-Metadaten.
5. **Download-Engine:** `yt-dlp` (wird als Binärdatei mitgeliefert oder automatisch bezogen) und `ffmpeg` zur Konvertierung der Streams in MP3 (320kbps).
6. **Metadaten-Verarbeitung:** `node-id3` zum Schreiben der ID3-Tags (Titel, Interpret, Album, Coverbild, BPM) direkt in die MP3s.
7. **BPM-Erkennung:** Node-basiertes Audio-Dekodieren und Beat-Detection (z. B. über `audio-decode` und `music-tempo`) zur automatischen Ermittlung der BPM.
8. **Audio-Wiedergabe & Effekte:** Web Audio API (im Renderer) für präzise Latenzkontrolle, EQ-Filter (Low/Mid/High), Time-Stretching (Tempo/Pitch-Änderung) und Loop-Steuerung.

---

## 3. Kernfunktionen & Technische Umsetzung

### 3.1 Playlist-Management & Synchronisation (Download-Engine)
- **Hinzufügen:** Der Benutzer fügt eine öffentliche YouTube-Playlist-URL hinzu.
- **Metadaten-Abruf:** Die App ruft über `yt-dlp --dump-single-json` die Playlist-Struktur ab (Titel, IDs, Thumbnails, Uploader).
- **Download-Pipeline:**
  1. Download der Audio-Spur im besten Format via `yt-dlp`.
  2. Konvertierung in MP3 (320kbps CBR) mittels `ffmpeg`.
  3. Herunterladen des Playlist-Thumbnails (als Cover).
  4. Analyse des Audios zur Ermittlung der BPM.
  5. Parsen von Title und Artist (z. B. Trennung von `"Artist - Title"` oder Nutzung des YouTube-Uploaders als Artist).
  6. Schreiben aller ID3-Tags in die MP3-Datei.
- **Sync-Cron:** Ein im Hintergrund laufender Timer prüft alle 30 Minuten die registrierten Playlists. Neue Tracks werden hinzugefügt, gelöschte Tracks werden aus der lokalen Datenbank und dem Dateisystem entfernt.

### 3.2 Metadaten & BPM-Analyse
- **ID3-Tags:** Jede MP3-Datei wird mit folgenden Tags versehen:
  - **Titel & Interpret:** Separiert aus dem YouTube-Titel (z. B. durch RegExp-Muster wie `Artist - Title (Official Video)`).
  - **Album:** Der Name der YouTube-Playlist.
  - **BPM:** Berechnet durch einen Beat-Detection-Algorithmus.
  - **Cover-Bild:** Das YouTube-Video-Thumbnail wird als Front-Cover in die ID3-Tags eingebettet.
- **BPM-Erkennung:**
  - Die MP3-Datei wird geladen und die rohen Audio-Samples dekodiert.
  - Ein Peak-Detection-Algorithmus analysiert transiente Amplitudenspitzen im Frequenzbereich (50–180 BPM) und errechnet das wahrscheinlichste Tempo.

### 3.3 DJ-Mix-Player (Web Audio API)
Der Player bietet fortgeschrittene Funktionen, die für DJ-Software typisch sind:
- **Zwei Decks (Deck A & Deck B):** Ermöglicht das Laden von Tracks auf zwei separate virtuelle Plattenspieler.
- **Audio-Steuerung:**
  - **Play/Pause & Cue:** Setzen und Ansteuern eines Cue-Points (Startpunkt).
  - **Tempo-Control (Pitch Slider):** Ändern der Wiedergabegeschwindigkeit um bis zu ±16% ohne Tonhöhenänderung (Time-Stretching) oder optional mit Tonhöhenkopplung.
  - **3-Band EQ:** Dedizierte Drehregler (Potentiometer / Potis) für Bässe (Low), Mitten (Mid) und Höhen (High) unter Verwendung von `BiquadFilterNode`s. Die Steuerung erfolgt per Maus-Drag (Hoch/Runter bzw. Rechts/Links) und unterstützt einen Doppelklick zum Zurücksetzen auf die neutrale 0dB-Position.
  - **Crossfader:** Blendregler zwischen Deck A und Deck B.
  - **Looping:** Manuelles oder taktsynchrones Looping (1, 2, 4, 8, 16 Beats) basierend auf der erkannten BPM.
- **Waveform-Visualisierung:**
  - Eine scrollende Waveform, die den gesamten Track und die aktuelle Abspielposition darstellt.
  - Zeichnen der Wellenform über ein HTML5 `<canvas>`-Element nach Vorab-Dekodierung der Audiodatei.

### 3.4 Einstellungen & Speicherort-Management
- **Speicherort-Auswahl:** Über ein Zahnrad-Symbol in der UI gelangt der Benutzer zu den Einstellungen. Hier kann ein beliebiger Pfad auf der Festplatte als Zielordner für Musikdownloads definiert werden.
- **Dateimigration:** Wird der Pfad geändert, prüft der Main-Prozess, ob sich im bisherigen Ordner bereits Musikdateien befinden. Ein nativer Dialog fragt den Nutzer:
  - *"Möchtest du die existierenden Musikdateien und Playlisten in den neuen Ordner verschieben?"*
  - Bei **Ja (Verschieben)**: Alle vorhandenen Ordner und MP3s werden an den neuen Ort verschoben. Pfade in der Datenbank werden automatisch aktualisiert.
  - Bei **Nein (Nur Pfad ändern)**: Die bestehenden Dateien verbleiben am alten Ort, neue Downloads werden jedoch im neuen Pfad abgelegt.
- **Theme-Umschaltung:** Der Benutzer kann das UI-Farbschema jederzeit zwischen Dark-Mode und Light-Mode umschalten. Die Einstellung wird persistent in der DB gespeichert.

### 3.5 Metadaten-Erweiterungen (Dateigröße, Format & Bewertung)
- **Dateigröße & Format:** In der Trackliste wird für jeden Titel die Dateigröße (z.B. "8.2 MB") und das Dateiformat (z.B. "MP3") angezeigt. Diese Daten werden beim Download per Node `fs.statSync` ausgelesen und in der DB gespeichert.
- **Sterne-Bewertung (Rating):** Der Benutzer kann Tracks direkt in der Liste mit 1 bis 5 Sternen bewerten.
- **ID3-Integration:** Das Rating wird persistent in die ID3-Tags der MP3-Audiodatei geschrieben. Hierzu wird das standardisierte **POPM-Frame (Popularimeter)** verwendet (bewertet von 0 bis 255: 1 Stern = 32, 2 Sterne = 64, 3 Sterne = 128, 4 Sterne = 196, 5 Sterne = 255). Dies stellt sicher, dass die Bewertungen auch in anderen DJ-Programmen (wie Serato, Traktor, iTunes) lesbar sind.

---

## 4. UI & UX Design

Die Benutzeroberfläche unterstützt zwei Modi:
- **Sleek-Dark-Mode:** Dunkles Anthrazit und tiefe Grautöne mit lebendigen Akzentfarben (Neon-Cyan, Violett) – perfekt für Club- und Studio-Umgebungen.
- **Clean-Light-Mode:** Ein kontrastreiches, helles Design für die Tageslicht-Nutzung.

Die Mixer-Sektion setzt auf authentische **runde Drehregler (Potis)** für die EQs (High, Mid, Low) anstelle von linearen Standard-Schiebereglern, um das Gefühl klassischer DJ-Hardware zu vermitteln.

### Interaktivitäts-Features:
- **Drag & Drop zum Laden:** Ein Track kann einfach per Maus aus der Tabelle gezogen und direkt auf Deck A oder Deck B fallengelassen werden, um ihn dort zu laden. Ein visueller Glow-Effekt signalisiert das aktive Drop-Ziel.
- **Persistent anpassbare Spaltenbreite (Splitter):** Die Spaltenbreite der Playlist-Sidebar und der Tracklist kann per Mausdrag an einem vertikalen Divider angepasst werden. Die Breite wird in den App-Einstellungen gespeichert und bleibt beim Neustart erhalten.


### Benutzeroberflächen-Layout:
1. **Sidebar (Links):**
   - Liste der synchronisierten Playlists mit Cover-Thumbnails und Sync-Status (inklusive des genauen Datums und der Uhrzeit der letzten Synchronisation, z.B. "Sync: 29.05.2026 11:51").
   - Button zum Hinzufügen einer neuen Playlist (öffnet ein modales Dialogfeld).
   - Einstellungs-Zahnrad am unteren Ende der Sidebar.
2. **Main-Bereich (Mitte):**
   - **Tracklist:** Eine Tabelle aller Tracks der ausgewählten Playlist.
     - Spalten: Cover, Titel, Interpret, BPM, Dauer, Aktionen.
     - Suchleiste zum schnellen Filtern.
3. **DJ-Mixer & Player (Oben oder Unten):**
   - Zwei Decks mit Plattenspieler-Mockup/Jogwheels und Canvas-Waveforms.
   - Mixer-Sektion in der Mitte: Crossfader, Kanalfader, 3-Band-EQ-Potis, Master-Lautstärke.
   - Cue-, Play-, Loop-Buttons und Pitch-Slider pro Deck.

---

## 5. Datei- & Speicherpfade (macOS)
- **Datenverzeichnis:** `~/Library/Application Support/RecordFox/`
- **Standard-Musikdateien:** `~/Library/Application Support/RecordFox/downloads/[Playlist-ID]/[Track-ID].mp3` (sofern nicht in den Einstellungen geändert)
- **Datenbank / Konfiguration:** `~/Library/Application Support/RecordFox/db.json`
- **yt-dlp Binärdatei:** Wird im Anwendungs-Ressourcenverzeichnis (`bin/`) abgelegt.

---

## 6. Sicherheits- und Performance-Aspekte
- **Sandboxing & IPC:** Renderer hat keinen direkten Dateisystem- oder Shell-Zugriff. Die gesamte Interaktion mit `yt-dlp` und dem Dateisystem erfolgt über sichere IPC-Kanäle im Main-Prozess.
- **Asynchroner Download:** Downloads laufen in einer Queue im Hintergrund, um die UI-Performance nicht zu beeinträchtigen.
- **Audio-Caching:** Lokale Dateien werden direkt als File-URLs im Renderer geladen.

