# 🦊 RekordFox - Master Engineering Roadmap

Diese Roadmap definiert die Entwicklungsschritte vom aktuellen Prototypen zum professionellen DJ-Performance-Tool. Die Priorität liegt strikt auf: **1. Performance -> 2. Beatmatching-Präzision -> 3. Effekte -> 4. Hardware.**

## Phase 1: Deep-Level Performance & Refactoring (Fokus: 60 FPS)
Bevor neue Features kommen, muss das System so optimiert werden, dass es selbst bei hoher CPU-Last nicht stottert.

- [ ] **Pre-Rendering via OffscreenCanvas:**
  - [ ] Den Waveform-Zeichnungs-Prozess aus dem Play-Loop nehmen.
  - [ ] Komplette Waveform beim Laden einmalig auf ein unsichtbares Canvas rendern.
  - [ ] Im `requestAnimationFrame` nur noch `ctx.drawImage()` (Bit-Blitting) für den aktuellen sichtbaren Ausschnitt nutzen.
- [ ] **React-State für High-Frequency-Updates entkoppeln:**
  - [ ] Die Millisekunden-Anzeige und die Waveform-Verschiebung dürfen keine React-Rerenders (`useState`) mehr auslösen.
  - [ ] Stattdessen direkte DOM-Manipulation über `useRef` (z.B. `timeLabelRef.current.innerText`) im Play-Loop anwenden.
- [ ] **Equal-Power Crossfader:**
  - [ ] Linearen Lautstärkeabfall in der Mitte beheben. Trigonometrische Kurve (Sinus/Cosinus) oder `Math.sqrt()` für den Gain-Wert des Crossfaders implementieren.

## Phase 2: Advanced Beatmatching & Sync-Engine (Fokus: Präzision)
Das Herzstück des DJings. Die Mathematik hinter den Tracks muss sichtbar und nutzbar gemacht werden.

- [ ] **Beat-Grid Rendering:**
  - [ ] Anhand von BPM und `currentTime` die genauen Pixel-Positionen der Beats berechnen.
  - [ ] Vertikale, mitlaufende Grid-Linien über die Waveform im Canvas zeichnen.
- [ ] **Phasen-Meter (Phase Alignment):**
  - [ ] Logik schreiben, die den Bruchteil eines Beats berechnet (z.B. Deck A ist bei Beat 4.2, Deck B bei Beat 8.5 -> Differenz 0.3 Beats).
  - [ ] Kleine UI-Komponente (Balken) über dem Crossfader bauen, die anzeigt, ob Deck B optisch vor oder hinter Deck A läuft.
- [ ] **Nudging / Pitch-Bend (Manuelles Angleichen):**
  - [ ] Buttons (`+` und `-`) in die UI einfügen.
  - [ ] Bei `onMouseDown` die `playbackRate` temporär um 3% erhöhen/verringern. Bei `onMouseUp` sofort auf den echten Pitch-Wert zurückspringen lassen.
- [ ] **Grid Snapping / Quantisierung:**
  - [ ] Globalen `Quantize`-Toggle einbauen.
  - [ ] Hilfsfunktion `getQuantizedTime()` schreiben, die Klick-Positionen oder Button-Presses auf den mathematisch nächsten vollen Beat (oder halben Beat) auf-/abrundet.
  - [ ] `seek()` und Loop-Aktionen durch diese Quantisierungs-Logik schleusen.

## Phase 3: Performance-Navigation (Fokus: Track-Kontrolle)
Tools, um live im Track zu springen, ohne den musikalischen Flow zu stören.

- [ ] **Hot Cues & Beat Jump:**
  - [ ] Speicherbare Hot Cues (1-8) implementieren (speichern in `@main/db`).
  - [ ] Beat Jump Buttons bauen (Springe exakt 16 oder 32 Beats vor/zurück durch Addition zur `currentTime`).
- [ ] **Key Sync / Harmonic Mixing:**
  - [ ] Button einbauen, der die Tonart von Deck B an Deck A anpasst.
  - [ ] Pitch-Shifting im WSOLA-Worklet ansteuern, um die Differenz in Halbtönen auszugleichen.
- [ ] **Overview-Waveform Navigation:**
  - [ ] Eine statische Miniatur-Waveform rendern.
  - [ ] Klick-Event hinzufügen, das prozentual zur Track-Länge rechnet und direkt einen `seek()` ausführt.
- [ ] **Vinyl Brake (Motor-Stopp):**
  - [ ] Beim Klick auf Pause den Track nicht hart abbrechen, sondern per `playbackRate.exponentialRampToValueAtTime()` sanft auf 0 drosseln.

## Phase 4: Sound-Design & Effekte (Fokus: Mix-Qualität)
Kreative Werkzeuge für nahtlose und spannende Übergänge.

- [ ] **"Color" Filter (Bi-Polar HPF/LPF):**
  - [ ] Einen Biquad-Filter pro Deck einrichten.
  - [ ] UI-Knob: Links von der Mitte = Low-Pass (Höhen weg), Rechts von der Mitte = High-Pass (Bässe weg), Mitte = Bypass.
- [ ] **Tempo-Synchrone Beat FX:**
  - [ ] Echo/Delay-Kette aufbauen (`DelayNode` -> `GainNode` -> Feedback-Loop).
  - [ ] Delay-Zeit dynamisch an die aktuelle BPM koppeln (z.B. exakt 1/2 Beat Delay).
- [ ] **Reverb / Wash-Out:**
  - [ ] `ConvolverNode` für Raumhall integrieren (für Drop-Build-Ups).
  - [ ] Optional ein Makro ("Wash-Out") bauen: Ein Button, der gleichzeitig Echo hochzieht, High-Pass aktiviert und Lautstärke senkt.
- [ ] **Slip Mode (Flux Mode):**
  - [ ] Wenn aktiviert, läuft beim Setzen eines Loops oder beim Scratchen/Pausieren ein Timer im Hintergrund weiter.
  - [ ] Beim Loslassen springt die `currentTime` per `seek()` exakt dorthin, wo der Track ohne den Eingriff gewesen wäre.

## Phase 5: Hardware-Integration & Pro-Routing (Fokus: Haptik)
Den Controller in ein echtes Stück Hardware verwandeln.

- [ ] **Pre-Fader Listen (PFL) / Kopfhörer-Routing:**
  - [ ] Audiosignal *vor* dem Line-Fader abgreifen.
  - [ ] Signal auf `audioContext.destination` Kanal 3/4 routen (Standard für DJ-Interface-Kopfhörer).
- [ ] **Web MIDI API (Controller-Mapping):**
  - [ ] `navigator.requestMIDIAccess()` integrieren.
  - [ ] Mapping-Dictionary schreiben (z.B. MIDI CC 12 -> EQ High Deck A).
  - [ ] Fader und Knobs von externen Controllern empfangen und auf die React/Engine-Logik mappen.
- [ ] **Master VU-Meter:**
  - [ ] `AnalyserNode` nach dem Master-Gain schalten.
  - [ ] RMS-Werte berechnen und als optische LED-Kette (grün/gelb/rot) darstellen, um Clipping zu vermeiden.

## Phase 6: Cloud-Library Expansion (SoundCloud Integration)
Das Ziel ist es, den bestehenden YouTube-Importer so zu abstrahieren, dass SoundCloud-URLs (Playlists & Tracks) durch dieselbe Analyse- und Tagging-Pipeline laufen.

- [ ] **Importer-Abstraktion (Adapter Pattern):**
  - [ ] Das bestehende Backend-Skript so umbauen, dass es eine generische `downloadTrack(url)` Funktion gibt.
  - [ ] URL-Erkennung schreiben: Prüfen, ob der String `youtube.com/youtu.be` oder `soundcloud.com` enthält, und den jeweiligen Downloader-Adapter aufrufen.
- [ ] **SoundCloud Scraper / API integrieren:**
  - [ ] *Entscheidung:* Entweder die offizielle SoundCloud API nutzen (Client ID schwer zu bekommen) ODER auf bewährte Libraries wie `yt-dlp` (via Node-Wrapper, unterstützt nativ SC!) oder NPM-Pakete wie `soundcloud-scraper` setzen.
  - [ ] Logik schreiben, um aus einem SoundCloud-Playlist-Link alle darin enthaltenen Track-URLs zu extrahieren.
- [ ] **Metadaten-Mapping (Vorbereitung für ID3):**
  - [ ] SoundCloud liefert oft extrem gute Metadaten. Die API/der Scraper muss folgendes abgreifen und an euren bestehenden ID3-Tagger übergeben:
    - `Artist` (Uploader-Name oder aus dem Titel geparst: "Artist - Title")
    - `Title`
    - `Artwork URL` (WICHTIG: Das hochauflösende 500x500 Cover laden, oft endet die URL auf `t500x500.jpg`, anstatt das kleine Thumbnail zu nehmen).
    - `Genre` (SoundCloud Tags)
- [ ] **Download & Konvertierung:**
  - [ ] Den Audio-Stream von SoundCloud laden (meist 128kbps MP3 oder Opus).
  - [ ] In das Format konvertieren (z.B. via `ffmpeg`), das eure Engine erwartet, falls der Stream nicht direkt kompatibel ist.
- [ ] **Pipeline-Verknüpfung:**
  - [ ] Die heruntergeladene und getaggte Datei exakt an die gleiche Stelle übergeben, an der auch die YouTube-Downloads landen, damit eure bestehende BPM- und Tonart-Analyse (Web Worker / Backend) automatisch anspringt.
- [ ] **UI-Update:**
  - [ ] Das Eingabefeld im Frontend anpassen: "YouTube oder SoundCloud Link einfügen".
  - [ ] Ein kleines Icon/Badge in der Track-Liste (`@main/db`) hinzufügen, das anzeigt, ob der Track von YT oder SC stammt (hilft später bei der Qualitätsbeurteilung, da YT und SC unterschiedliche Audio-Kompressionen nutzen).