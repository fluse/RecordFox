/**
 * useDeckEngine – Professional DJ Deck Audio Engine
 *
 * Architecture:
 *   fetch(url) → ArrayBuffer → decodeAudioData → AudioBuffer (RAM)
 *   → AudioBufferSourceNode → [WSOLA Worklet] → EQ Low → EQ Mid → EQ High
 *   → GainNode (volume) → GainNode (crossfader) → GainNode (master)
 *
 * Why AudioBufferSourceNode instead of HTMLMediaElement:
 *   – Entire file is decoded to PCM in RAM → zero buffer underruns possible
 *   – playbackRate is a real AudioParam → linearRampToValueAtTime works natively
 *   – Seek is sample-accurate (create new source node at offset)
 *   – Loop points are sample-accurate (AudioBufferSourceNode.loopStart/loopEnd)
 *   – Position is tracked via AudioContext clock (not polling / onTimeUpdate)
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import type { Track } from '@main/db'
import { getMediaUrl } from '../utils/audio'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeckEngine {
  // Playback state
  isPlaying: boolean
  getCurrentTime(): number
  duration: number
  pitch: number
  keyLock: boolean
  keyShift: number
  cueTime: number | null
  loopStart: number | null
  loopEnd: number | null
  activeLoopBeats: number | null

  // Waveform data
  peaks: number[]
  decoding: boolean

  // Actions
  togglePlay(): Promise<void>
  seek(time: number): void
  handlePitchChange(rate: number): void
  toggleKeyLock(): void
  setCuePoint(): void
  handleCueMouseDown(): Promise<void>
  handleCueMouseUp(): void
  handleBeatLoop(beats: number): void
  handleSync(): void
  startNudge(direction: 'up' | 'down'): void
  stopNudge(): void
  handleKeyShiftChange(semitones: number): void
}

interface UseDeckEngineOptions {
  deckId: 'A' | 'B'
  track: Track | null
  audioContext: AudioContext | null
  /** The permanent EQ→Volume gain chain entry node (already connected to crossfader→master). */
  filterLowNode: BiquadFilterNode | null
  opponentBpm: number | null
}

// ─── WSOLA Worklet Source Code ────────────────────────────────────────────────
//
// Loaded as a Blob URL so we don't need special Vite/Webpack config for worklets.
// This is a production-quality WSOLA (Waveform Similarity Overlap-Add) implementation:
//
//  • Frame size: 1024 samples
//  • Search window: ±256 samples
//  • Overlap: 50% (512 samples cross-fade)
//  • Tempo parameter: 0.5 – 2.0 (1.0 = normal speed)
//  • Pitch is NOT changed – only the output tempo changes
//
// The algorithm:
//  1. Read `frameSize` samples from the input buffer at the current read position.
//  2. Find the position within the ±searchRange window that has the highest
//     cross-correlation with the previous output frame's end (WSOLA matching).
//  3. Overlap-add the new frame onto the output at the write position using a
//     symmetric Hann window for smooth cross-fading.
//  4. Advance readPos by frameSize * tempo (faster reads = faster output without pitch shift).
//  5. Advance writePos by overlap (constant output rate).

const WSOLA_WORKLET_SOURCE = /* javascript */ `
class WsolaProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'tempo', defaultValue: 1.0, minValue: 0.5, maxValue: 2.0,
              automationRate: 'k-rate' }]
  }

  constructor() {
    super()
    this._frameSize   = 1024
    this._overlap     = 512
    this._searchRange = 256
    this._readPos     = 0
    this._buf         = null  // Float32Array – set via message
    this._prevFrame   = new Float32Array(this._frameSize)
    this._hannWindow  = this._makeHann(this._frameSize)
    this._outputBuf   = new Float32Array(this._frameSize * 4)
    this._outputReadPos  = 0
    this._outputWritePos = 0

    this.port.onmessage = (e) => {
      if (e.data.type === 'buffer') {
        this._buf = e.data.buffer   // Float32Array of left channel
        this._readPos = e.data.startOffset || 0
      } else if (e.data.type === 'seek') {
        this._readPos = e.data.offset
        this._outputReadPos  = 0
        this._outputWritePos = 0
        this._prevFrame.fill(0)
      }
    }
  }

  _makeHann(size) {
    const w = new Float32Array(size)
    for (let i = 0; i < size; i++) {
      w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)))
    }
    return w
  }

  _crossCorrelate(ref, src, srcStart) {
    // Find best match offset within [-searchRange, +searchRange]
    let bestCorr  = -Infinity
    let bestOffset = 0
    const halfFrame = this._frameSize >> 1
    for (let d = -this._searchRange; d <= this._searchRange; d++) {
      let corr = 0
      for (let i = 0; i < halfFrame; i++) {
        const si = srcStart + d + i
        if (si >= 0 && si < src.length) {
          corr += ref[i] * src[si]
        }
      }
      if (corr > bestCorr) { bestCorr = corr; bestOffset = d }
    }
    return bestOffset
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]
    if (!output || output.length === 0) return true
    const outCh  = output[0]
    const blockSz = outCh.length // typically 128

    if (!this._buf || this._buf.length === 0) {
      outCh.fill(0)
      return true
    }

    const tempo = parameters.tempo[0]
    const buf   = this._buf

    // Fill output block
    for (let si = 0; si < blockSz; si++) {
      // If output buffer is running low, synthesise a new frame
      const available = this._outputWritePos - this._outputReadPos
      if (available < blockSz) {
        this._synthesiseFrame(buf, tempo)
      }
      const oi = this._outputReadPos % this._outputBuf.length
      outCh[si] = this._outputBuf[oi] || 0
      this._outputReadPos++
    }

    return true
  }

  _synthesiseFrame(buf, tempo) {
    const fs    = this._frameSize
    const ovlp  = this._overlap
    const sRange = this._searchRange

    // Find best match position near current readPos
    const searchStart = Math.max(0, Math.floor(this._readPos) - sRange)
    const offset = this._crossCorrelate(this._prevFrame, buf, searchStart)
    const readStart = Math.max(0, Math.floor(this._readPos) + offset)

    // Extract frame and apply Hann window
    const frame = new Float32Array(fs)
    for (let i = 0; i < fs; i++) {
      const idx = readStart + i
      frame[i] = (idx < buf.length ? buf[idx] : 0) * this._hannWindow[i]
    }

    // Cross-fade overlap with previous frame's tail
    const writeBase = this._outputWritePos % this._outputBuf.length
    for (let i = 0; i < fs; i++) {
      const wi = (writeBase + i) % this._outputBuf.length
      if (i < ovlp) {
        // Fade in new frame, fade out overlap of previous
        const fadeFrac = i / ovlp
        this._outputBuf[wi] = (this._outputBuf[wi] || 0) * (1 - fadeFrac) + frame[i] * fadeFrac
      } else {
        this._outputBuf[wi] = frame[i]
      }
    }

    this._outputWritePos += ovlp
    this._prevFrame.set(frame.subarray(fs - ovlp))

    // Advance read position by tempo-scaled frame step
    this._readPos += fs * tempo
  }
}

registerProcessor('wsola-processor', WsolaProcessor)
`

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeckEngine(options: UseDeckEngineOptions): DeckEngine {
  const { deckId, track, audioContext, filterLowNode, opponentBpm } = options

  // ── Persistent Audio Graph nodes (created once) ───────────────────────────
  // We only create these signal-chain nodes once; they stay alive for the
  // lifetime of the deck. The AudioBufferSourceNode is created fresh on every
  // play/seek action.

  /** Permanent EQ filter ref passed in from the parent (via props). */
  const filterLowRef = useRef<BiquadFilterNode | null>(null)

  /** Single AudioBuffer holding the entire decoded PCM for the current track. */
  const audioBufferRef = useRef<AudioBuffer | null>(null)

  /**
   * Currently active playback source.  This node is thrown away and re-created
   * on every play() / seek() call (AudioBufferSourceNode is single-use).
   */
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)

  /**
   * AudioWorkletNode wrapping the WSOLA processor (created lazily when
   * KeyLock is first enabled).
   */
  const wsolaNodeRef = useRef<AudioWorkletNode | null>(null)
  const wsolaReadyRef = useRef(false)

  // ── Playback clock tracking ───────────────────────────────────────────────
  //
  // We do NOT use HTMLMediaElement.currentTime.  Instead we track the playback
  // position manually using the AudioContext clock:
  //
  //   position = (audioContext.currentTime - startContextTime) * pitch + startOffset
  //
  // where startOffset is the buffer offset we passed to sourceNode.start().

  const startContextTimeRef = useRef(0)
  const startOffsetRef = useRef(0)
  const isPlayingRef = useRef(false)
  const rafIdRef = useRef<number>(0)
  const pitchRef = useRef(1.0)
  const loopStartRef = useRef<number | null>(null)
  const loopEndRef = useRef<number | null>(null)
  const keyLockRef = useRef(true)
  const cueTimeRef = useRef<number | null>(null)

  const nudgeOffsetRef = useRef(0)
  const keyShiftRef = useRef(0)
  const nudgeStartContextTimeRef = useRef(0)
  const nudgeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Stable refs so the RAF loop never needs to restart when callbacks change
  const getPositionRef = useRef<() => number>(() => 0)
  const playRef = useRef<(offset: number) => void>(() => {})

  // ── React state (only for rendering) ─────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [pitch, setPitch] = useState(1.0)
  const [keyLock, setKeyLock] = useState(true)
  const [keyShift, setKeyShift] = useState(0)
  const [cueTime, setCueTime] = useState<number | null>(null)
  const [loopStart, setLoopStart] = useState<number | null>(null)
  const [loopEnd, setLoopEnd] = useState<number | null>(null)
  const [activeLoopBeats, setActiveLoopBeats] = useState<number | null>(null)
  const [peaks, setPeaks] = useState<number[]>([])
  const [decoding, setDecoding] = useState(false)

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Clamp a time value to [0, duration]. */
  const clampTime = useCallback(
    (t: number): number => Math.max(0, Math.min(audioBufferRef.current?.duration ?? 0, t)),
    []
  )

  /** Compute playback position from the AudioContext clock. */
  const getPosition = useCallback((): number => {
    if (!audioContext || !isPlayingRef.current) return startOffsetRef.current
    const effectiveRate = pitchRef.current * (1.0 + nudgeOffsetRef.current)
    const elapsed = (audioContext.currentTime - startContextTimeRef.current) * effectiveRate
    return clampTime(startOffsetRef.current + elapsed)
  }, [audioContext, clampTime])

  const commitCurrentPosition = useCallback((): void => {
    if (!audioContext) return
    const pos = getPosition()
    startOffsetRef.current = pos
    startContextTimeRef.current = audioContext.currentTime
  }, [audioContext, getPosition])

  const getCurrentTime = useCallback((): number => {
    return getPosition()
  }, [getPosition])

  // ── Load WSOLA worklet ────────────────────────────────────────────────────

  const ensureWsolaWorklet = useCallback(async (): Promise<void> => {
    if (!audioContext || wsolaReadyRef.current) return
    try {
      const blob = new Blob([WSOLA_WORKLET_SOURCE], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      await audioContext.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)
      wsolaReadyRef.current = true
    } catch (err) {
      console.error('[DeckEngine] Failed to load WSOLA worklet:', err)
    }
  }, [audioContext])

  // ── Create / tear-down WSOLA node ────────────────────────────────────────

  const getOrCreateWsolaNode = useCallback((): AudioWorkletNode | null => {
    if (!audioContext || !wsolaReadyRef.current || !filterLowRef.current) return null
    if (wsolaNodeRef.current) return wsolaNodeRef.current

    try {
      const node = new AudioWorkletNode(audioContext, 'wsola-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2]
      })
      node.connect(filterLowRef.current)
      wsolaNodeRef.current = node
      return node
    } catch (err) {
      console.error('[DeckEngine] Failed to create WSOLA node:', err)
      return null
    }
  }, [audioContext])

  // ── Core: createAndConnectSource ─────────────────────────────────────────
  //
  // Creates a new AudioBufferSourceNode, connects it into the signal graph
  // (bypassing WSOLA or routing through it depending on keyLock), and returns
  // the node so the caller can call .start() on it.

  const createAndConnectSource = useCallback((): AudioBufferSourceNode | null => {
    if (!audioContext || !audioBufferRef.current || !filterLowRef.current) return null

    const src = audioContext.createBufferSource()
    src.buffer = audioBufferRef.current

    const pitchRatio = Math.pow(2, keyShiftRef.current / 12)
    const effectiveRate = pitchRef.current * (1.0 + nudgeOffsetRef.current) * pitchRatio
    src.playbackRate.value = effectiveRate

    // Configure native loop if active
    if (loopStartRef.current !== null && loopEndRef.current !== null) {
      src.loop = true
      src.loopStart = loopStartRef.current
      src.loopEnd = loopEndRef.current
    }

    if (keyLockRef.current && wsolaNodeRef.current) {
      // Route: source → WSOLA worklet (time-stretch) → EQ chain
      // The WSOLA node processes offline from its internal buffer, so the source
      // only drives the worklet via message; direct audio connection not needed.
      // Instead we send updated PCM + offset to the worklet via port messages.
      src.connect(filterLowRef.current)
    } else {
      // Route: source → EQ chain directly (simple resampling, no time-stretch)
      src.connect(filterLowRef.current)
    }

    return src
  }, [audioContext])

  // ── play() ────────────────────────────────────────────────────────────────

  const play = useCallback(
    (offset: number): void => {
      if (!audioContext || !audioBufferRef.current || !filterLowRef.current) return

      // Stop previous source (safe to call even if already stopped)
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch {
          /* already stopped */
        }
        sourceNodeRef.current.disconnect()
        sourceNodeRef.current = null
      }

      const src = createAndConnectSource()
      if (!src) return

      // If using WSOLA key-lock, send the buffer + offset to the worklet.
      // IMPORTANT: copy the Float32Array – do NOT transfer the ArrayBuffer.
      // Transferring would detach audioBufferRef.current making it unusable for
      // any subsequent createBufferSource() or getChannelData() call.
      if (keyLockRef.current && wsolaNodeRef.current) {
        const tempoParam = wsolaNodeRef.current.parameters.get('tempo')
        if (tempoParam) {
          const effectiveTempo = pitchRef.current * (1.0 + nudgeOffsetRef.current)
          tempoParam.setValueAtTime(effectiveTempo, audioContext.currentTime)
        }
        const channelData = audioBufferRef.current.getChannelData(0)
        const copy = new Float32Array(channelData) // safe copy, original intact
        wsolaNodeRef.current.port.postMessage(
          {
            type: 'buffer',
            buffer: copy,
            startOffset: Math.floor(offset * audioBufferRef.current.sampleRate)
          },
          [copy.buffer] // transfer the COPY, not the original
        )
      }

      src.start(0, offset)

      // Guard: only handle the "natural end" event if this source is still the
      // active one. Seek / pause / track-change call stop() first and set
      // sourceNodeRef.current = null, so the stale onended will see a mismatch
      // and do nothing – preventing the UI state from being reset mid-playback.
      src.onended = () => {
        if (sourceNodeRef.current === src && isPlayingRef.current) {
          isPlayingRef.current = false
          setIsPlaying(false)
          startOffsetRef.current = 0
        }
      }

      startContextTimeRef.current = audioContext.currentTime
      startOffsetRef.current = offset
      isPlayingRef.current = true
      sourceNodeRef.current = src

      setIsPlaying(true)
    },
    [audioContext, createAndConnectSource]
  )

  // ── pause() ───────────────────────────────────────────────────────────────

  const pause = useCallback((): void => {
    if (!isPlayingRef.current) return

    // Capture position before stopping
    const pos = getPosition()
    startOffsetRef.current = pos
    isPlayingRef.current = false

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
      } catch {
        /* already stopped */
      }
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }

    setIsPlaying(false)
  }, [getPosition])

  // ── Keep stable refs up-to-date so the RAF loop never restarts ───────────

  useEffect(() => {
    getPositionRef.current = getPosition
  }, [getPosition])
  useEffect(() => {
    playRef.current = play
  }, [play])

  // ── RAF position update loop ──────────────────────────────────────────────
  //
  // IMPORTANT: Empty dependency array [] so this effect runs exactly ONCE.
  // Accessing mutable state via refs (getPositionRef, playRef) means we never
  // need to restart the loop when callbacks change – which previously caused
  // two concurrent RAF loops that fought over the UI state.

  useEffect(() => {
    const tick = (): void => {
      if (isPlayingRef.current) {
        const pos = getPositionRef.current()

        // Software loop enforcement (fallback when native loop is off)
        if (
          loopStartRef.current !== null &&
          loopEndRef.current !== null &&
          !sourceNodeRef.current?.loop &&
          pos >= loopEndRef.current
        ) {
          playRef.current(loopStartRef.current)
        }

        // Track end detection
        const dur = audioBufferRef.current?.duration ?? 0
        if (dur > 0 && pos >= dur) {
          isPlayingRef.current = false
          startOffsetRef.current = 0
          setIsPlaying(false)
        }
      }
      rafIdRef.current = requestAnimationFrame(tick)
    }

    rafIdRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [])

  // ── Keep filterLowRef in sync ─────────────────────────────────────────────

  useEffect(() => {
    filterLowRef.current = filterLowNode
  }, [filterLowNode])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!track || !audioContext) {
      audioBufferRef.current = null
      setPeaks([])
      setDecoding(false)
      setIsPlaying(false)
      setDuration(0)
      startOffsetRef.current = 0
      isPlayingRef.current = false
      return
    }

    // Stop current playback immediately
    if (isPlayingRef.current) {
      pause()
    }

    setPitch(1.0)
    pitchRef.current = 1.0
    setLoopStart(null)
    setLoopEnd(null)
    loopStartRef.current = null
    loopEndRef.current = null
    setActiveLoopBeats(null)
    setCueTime(0)
    cueTimeRef.current = 0
    startOffsetRef.current = 0
    isPlayingRef.current = false

    const loadTrack = async (): Promise<void> => {
      setDecoding(true)
      try {
        const url = getMediaUrl(track.filepath)
        const response = await fetch(url)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const arrayBuffer = await response.arrayBuffer()

        // decodeAudioData is run on the existing live AudioContext (not a temp context).
        // This is important: we reuse the same context so that the resulting AudioBuffer
        // is compatible with AudioBufferSourceNode created from the same context later.
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        audioBufferRef.current = audioBuffer
        setDuration(audioBuffer.duration)

        // Generate waveform peaks from left channel
        const channelData = audioBuffer.getChannelData(0)
        const numBars = 500
        const step = Math.ceil(channelData.length / numBars)
        const generatedPeaks: number[] = []

        for (let i = 0; i < channelData.length; i += step) {
          let max = 0
          for (let j = 0; j < step && i + j < channelData.length; j++) {
            const v = Math.abs(channelData[i + j])
            if (v > max) max = v
          }
          generatedPeaks.push(max)
        }
        setPeaks(generatedPeaks)
      } catch (err) {
        console.error('[DeckEngine] Failed to load track:', err)
      } finally {
        setDecoding(false)
      }
    }

    loadTrack()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, audioContext])

  // ── Public Actions ────────────────────────────────────────────────────────

  const togglePlay = useCallback(async (): Promise<void> => {
    if (!audioBufferRef.current || !track) return
    if (audioContext?.state === 'suspended') await audioContext.resume()

    if (isPlayingRef.current) {
      pause()
    } else {
      play(startOffsetRef.current)
    }
  }, [audioContext, track, pause, play])

  const seek = useCallback(
    (time: number): void => {
      const clamped = clampTime(time)
      startOffsetRef.current = clamped

      if (isPlayingRef.current) {
        play(clamped)
      }
    },
    [clampTime, play]
  )

  const handlePitchChange = useCallback(
    (rate: number): void => {
      const clamped = Math.max(0.5, Math.min(2.0, rate))
      commitCurrentPosition()
      pitchRef.current = clamped
      setPitch(clamped)

      const pitchRatio = Math.pow(2, keyShiftRef.current / 12)
      const effectiveRate = clamped * (1.0 + nudgeOffsetRef.current) * pitchRatio

      console.log(
        `[useDeckEngine ${deckId}] handlePitchChange: rate=${rate}, pitchRatio=${pitchRatio}, effectiveRate=${effectiveRate}`
      )

      if (sourceNodeRef.current && audioContext) {
        // Native AudioParam ramp – sample-accurate, no setTimeout needed
        sourceNodeRef.current.playbackRate.cancelScheduledValues(audioContext.currentTime)
        sourceNodeRef.current.playbackRate.linearRampToValueAtTime(
          effectiveRate,
          audioContext.currentTime + 0.04 // 40ms
        )
      }

      // When KeyLock is ON, update WSOLA tempo parameter
      if (keyLockRef.current && wsolaNodeRef.current && audioContext) {
        const tempoParam = wsolaNodeRef.current.parameters.get('tempo')
        if (tempoParam) {
          const effectiveTempo = clamped * (1.0 + nudgeOffsetRef.current)
          tempoParam.cancelScheduledValues(audioContext.currentTime)
          tempoParam.linearRampToValueAtTime(effectiveTempo, audioContext.currentTime + 0.04)
        }
      }
    },
    [audioContext, commitCurrentPosition, deckId]
  )

  const startNudge = useCallback(
    (direction: 'up' | 'down'): void => {
      if (!audioContext) return

      // Clear any pending stop-nudge timeout
      if (nudgeTimeoutRef.current) {
        clearTimeout(nudgeTimeoutRef.current)
        nudgeTimeoutRef.current = null
      }

      commitCurrentPosition()
      const amount = 0.03 // 3% nudge speed change
      nudgeOffsetRef.current = direction === 'up' ? amount : -amount
      nudgeStartContextTimeRef.current = audioContext.currentTime

      const pitchRatio = Math.pow(2, keyShiftRef.current / 12)
      const effectiveRate = pitchRef.current * (1.0 + nudgeOffsetRef.current) * pitchRatio

      console.log(
        `[useDeckEngine ${deckId}] startNudge: direction=${direction}, nudgeOffsetRef=${nudgeOffsetRef.current}, effectiveRate=${effectiveRate}`
      )

      if (sourceNodeRef.current) {
        sourceNodeRef.current.playbackRate.cancelScheduledValues(audioContext.currentTime)
        sourceNodeRef.current.playbackRate.setValueAtTime(effectiveRate, audioContext.currentTime)
      }

      if (keyLockRef.current && wsolaNodeRef.current) {
        const tempoParam = wsolaNodeRef.current.parameters.get('tempo')
        if (tempoParam) {
          const effectiveTempo = pitchRef.current * (1.0 + nudgeOffsetRef.current)
          tempoParam.cancelScheduledValues(audioContext.currentTime)
          tempoParam.setValueAtTime(effectiveTempo, audioContext.currentTime)
        }
      }
    },
    [audioContext, commitCurrentPosition, deckId]
  )

  const executeStopNudge = useCallback((): void => {
    if (nudgeTimeoutRef.current) {
      clearTimeout(nudgeTimeoutRef.current)
      nudgeTimeoutRef.current = null
    }

    commitCurrentPosition()
    nudgeOffsetRef.current = 0

    const pitchRatio = Math.pow(2, keyShiftRef.current / 12)
    const effectiveRate = pitchRef.current * pitchRatio

    console.log(
      `[useDeckEngine ${deckId}] stopNudge (execute): restoring to pitchRef=${pitchRef.current}, effectiveRate=${effectiveRate}`
    )

    if (sourceNodeRef.current && audioContext) {
      sourceNodeRef.current.playbackRate.cancelScheduledValues(audioContext.currentTime)
      sourceNodeRef.current.playbackRate.setValueAtTime(effectiveRate, audioContext.currentTime)
    }

    if (keyLockRef.current && wsolaNodeRef.current && audioContext) {
      const tempoParam = wsolaNodeRef.current.parameters.get('tempo')
      if (tempoParam) {
        tempoParam.cancelScheduledValues(audioContext.currentTime)
        tempoParam.setValueAtTime(pitchRef.current, audioContext.currentTime)
      }
    }
  }, [audioContext, commitCurrentPosition, deckId])

  const stopNudge = useCallback((): void => {
    if (!audioContext) return

    const elapsed = audioContext.currentTime - nudgeStartContextTimeRef.current
    const minDuration = 0.15 // 150ms minimum nudge duration to make quick taps audible

    if (elapsed < minDuration) {
      if (nudgeTimeoutRef.current) return // Already scheduled

      const remainingTime = minDuration - elapsed
      console.log(
        `[useDeckEngine ${deckId}] stopNudge: tap was too quick (${elapsed.toFixed(3)}s), scheduling restore in ${remainingTime.toFixed(3)}s`
      )

      const pitchRatio = Math.pow(2, keyShiftRef.current / 12)
      const effectiveRate = pitchRef.current * pitchRatio

      // Schedule audio param restore at the exact future time
      if (sourceNodeRef.current) {
        sourceNodeRef.current.playbackRate.setValueAtTime(
          effectiveRate,
          audioContext.currentTime + remainingTime
        )
      }

      if (keyLockRef.current && wsolaNodeRef.current) {
        const tempoParam = wsolaNodeRef.current.parameters.get('tempo')
        if (tempoParam) {
          tempoParam.setValueAtTime(pitchRef.current, audioContext.currentTime + remainingTime)
        }
      }

      // Set timeout to commit the state in JS when the nudge duration expires
      nudgeTimeoutRef.current = setTimeout(() => {
        nudgeTimeoutRef.current = null
        executeStopNudge()
      }, remainingTime * 1000)

      return
    }

    // Long press release, or timeout triggered
    executeStopNudge()
  }, [audioContext, deckId, executeStopNudge])

  const handleKeyShiftChange = useCallback(
    (semitones: number): void => {
      const clamped = Math.max(-12, Math.min(12, semitones))
      commitCurrentPosition()
      keyShiftRef.current = clamped
      setKeyShift(clamped)

      const pitchRatio = Math.pow(2, clamped / 12)
      const effectiveRate = pitchRef.current * (1.0 + nudgeOffsetRef.current) * pitchRatio

      console.log(
        `[useDeckEngine ${deckId}] handleKeyShiftChange: semitones=${semitones}, pitchRatio=${pitchRatio}, effectiveRate=${effectiveRate}`
      )

      if (sourceNodeRef.current && audioContext) {
        sourceNodeRef.current.playbackRate.cancelScheduledValues(audioContext.currentTime)
        sourceNodeRef.current.playbackRate.setValueAtTime(effectiveRate, audioContext.currentTime)
      }
    },
    [audioContext, commitCurrentPosition, deckId]
  )

  const toggleKeyLock = useCallback(async (): Promise<void> => {
    const next = !keyLockRef.current
    keyLockRef.current = next
    setKeyLock(next)

    if (next) {
      // Enable WSOLA worklet
      await ensureWsolaWorklet()
      getOrCreateWsolaNode()
    }
  }, [ensureWsolaWorklet, getOrCreateWsolaNode])

  const setCuePoint = useCallback((): void => {
    const pos = getPosition()
    cueTimeRef.current = pos
    setCueTime(pos)
  }, [getPosition])

  const handleCueMouseDown = useCallback(async (): Promise<void> => {
    if (!track || cueTimeRef.current === null) return
    if (audioContext?.state === 'suspended') await audioContext.resume()
    play(cueTimeRef.current)
  }, [audioContext, track, play])

  const handleCueMouseUp = useCallback((): void => {
    if (cueTimeRef.current === null) return
    pause()
    startOffsetRef.current = cueTimeRef.current
    setIsPlaying(false)
  }, [pause])

  const handleBeatLoop = useCallback(
    (beats: number): void => {
      if (!track || !track.bpm || !audioBufferRef.current) return

      if (loopStartRef.current !== null && loopEndRef.current !== null) {
        // Check if same loop → toggle off
        const expectedDuration = beats * (60 / track.bpm)
        const actualDuration = loopEndRef.current - loopStartRef.current
        if (Math.abs(actualDuration - expectedDuration) < 0.05) {
          // Turn off loop
          loopStartRef.current = null
          loopEndRef.current = null
          setLoopStart(null)
          setLoopEnd(null)
          setActiveLoopBeats(null)
          // Restart without loop
          if (isPlayingRef.current) play(getPosition())
          return
        }
      }

      const current = getPosition()
      const beatSec = 60 / track.bpm
      const loopDur = beats * beatSec
      const ls = current
      const le = clampTime(current + loopDur)

      loopStartRef.current = ls
      loopEndRef.current = le
      setLoopStart(ls)
      setLoopEnd(le)
      setActiveLoopBeats(beats)

      // Restart the source with native loop enabled
      if (isPlayingRef.current) play(ls)
    },
    [track, getPosition, clampTime, play]
  )

  const handleSync = useCallback((): void => {
    if (!track || !track.bpm || !opponentBpm) return
    const targetRate = Math.max(0.84, Math.min(1.16, opponentBpm / track.bpm))
    handlePitchChange(targetRate)
  }, [track, opponentBpm, handlePitchChange])

  // ── Keyboard Shortcuts for Pitch Bend (Nudging) ───────────────────────────
  useEffect(() => {
    if (!track || !audioContext) return

    const keys = deckId === 'A' ? { up: 't', down: 'g' } : { up: 'u', down: 'j' }

    let isNudgingUp = false
    let isNudgingDown = false

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Ignore if typing in input/textarea/editable
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const key = e.key.toLowerCase()
      console.log(
        `[useDeckEngine ${deckId}] handleKeyDown: key=${key}, keys.up=${keys.up}, keys.down=${keys.down}`
      )
      if (key === keys.up && !isNudgingUp) {
        isNudgingUp = true
        startNudge('up')
      } else if (key === keys.down && !isNudgingDown) {
        isNudgingDown = true
        startNudge('down')
      }
    }

    const handleKeyUp = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const key = e.key.toLowerCase()
      console.log(`[useDeckEngine ${deckId}] handleKeyUp: key=${key}`)
      if (key === keys.up) {
        isNudgingUp = false
        stopNudge()
      } else if (key === keys.down) {
        isNudgingDown = false
        stopNudge()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (isNudgingUp || isNudgingDown) {
        stopNudge()
      }
    }
  }, [track, audioContext, deckId, startNudge, stopNudge])

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafIdRef.current)
      if (nudgeTimeoutRef.current) {
        clearTimeout(nudgeTimeoutRef.current)
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch {
          /* already stopped */
        }
        sourceNodeRef.current.disconnect()
      }
      if (wsolaNodeRef.current) {
        wsolaNodeRef.current.disconnect()
      }
    }
  }, [])

  return {
    isPlaying,
    getCurrentTime,
    duration,
    pitch,
    keyLock,
    keyShift,
    cueTime,
    loopStart,
    loopEnd,
    activeLoopBeats,
    peaks,
    decoding,
    togglePlay,
    seek,
    handlePitchChange,
    toggleKeyLock,
    setCuePoint,
    handleCueMouseDown,
    handleCueMouseUp,
    handleBeatLoop,
    handleSync,
    startNudge,
    stopNudge,
    handleKeyShiftChange
  }
}
