# 🦊 Phase 1: Deep-Level Performance & Refactoring (Fokus: 60 FPS)

Dieses Dokument beschreibt den detaillierten Umsetzungsplan für Phase 1 der RekordFox-Entwicklung. Das Hauptziel ist die Entlastung des Hauptthreads auf stabile 60 FPS durch die Vermeidung unnötiger React-Re-renders und die Beschleunigung des Waveform-Zeichnens.

---

## 🎯 Überblick der Phase 1

1. **Schritt 1: React-State für High-Frequency-Updates entkoppeln**
   - **Ziel:** Entfernen des `currentTime` React-States, um hunderte von Rerenders pro Sekunde zu vermeiden.
   - **Lösung:** Einführung eines Getters `getCurrentTime()` und direkte DOM-Manipulation der Millisekunden-Anzeige und der Waveforms.
2. **Schritt 2: Pre-Rendering der Waveform via OffscreenCanvas**
   - **Ziel:** Zeichnen der Waveform aus dem Play-Loop (60 FPS) entfernen.
   - **Lösung:** Waveform beim Laden einmalig auf ein unsichtbares Canvas rendern und im Play-Loop per `drawImage` (Bit-Blitting) verschieben.
3. **Schritt 3: Equal-Power Crossfader**
   - **Ziel:** Linearen Lautstärkeabfall in der Mitte des Crossfaders beheben.
   - **Lösung:** Trigonometrische Kurve (Sinus/Cosinus) oder `Math.sqrt()` zur Gain-Berechnung einführen.

---

## 🛠️ Detaillierter Ablauf & Code-Spezifikationen für Schritt 1

### Zielstellung

Der `currentTime`-State in `useDeckEngine.ts` aktualisiert sich bei laufender Wiedergabe über einen `requestAnimationFrame`-Loop permanent. Dies führt dazu, dass die gesamte `Deck.tsx`-Komponente und alle darin verschachtelten Elemente permanent neu gerendert werden.

Für Echtzeit-Audio und flüssige Animationen entkoppeln wir diesen Wert vollständig von React.

### Geplante Änderungen

#### 1. Hook: `src/renderer/src/hooks/useDeckEngine.ts`

- Entfernung des States `currentTime` und der Aufrufe von `setCurrentTime`.
- Ergänzung der `DeckEngine`-Schnittstelle um die Methode `getCurrentTime(): number`.
- Implementierung der Methode mittels eines stabilen `useCallback`, das auf das präzise `getPosition()` verweist.

#### 2. Komponente: `src/renderer/src/components/Deck.tsx`

- Hinzufügen von React-Refs für die Zeitanzeigen (`timeRemainingValueRef` und `timeOverlayRef`).
- Entfernung von `engine.currentTime` aus dem Canvas-Zeichnungs-`useEffect`.
- Im `draw`-Loop des Canvas:
  - Abrufen der aktuellen Zeit über `engine.getCurrentTime()`.
  - Direktes Beschreiben von `innerText`/`textContent` der Zeitanzeige-DOM-Elemente.
  - Verwenden der ausgelesenen Zeit für das Scrolling der Waveform.
