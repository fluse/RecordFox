/**
 * Deck.tsx – DJ Deck UI Component
 *
 * This component is PURELY responsible for UI rendering and user interaction.
 * All audio engine logic lives in useDeckEngine.ts.
 *
 * Signal chain (created here, passed into useDeckEngine):
 *   AudioBufferSourceNode (useDeckEngine)
 *     → filterLow  ← entry point (filterLowRef passed to hook)
 *     → filterMid
 *     → filterHigh
 *     → gainNode (volume)
 *     → crossfaderGain (A or B)
 *     → masterGain
 *     → AudioContext.destination
 */

import React, { useRef, useState, useEffect } from 'react'
import { Play, Pause, Lock, Unlock } from 'lucide-react'
import type { Track } from '@main/db'
import { formatDuration } from '../utils/audio'
import { useLanguage } from '../i18n'
import { useDeckEngine } from '../hooks/useDeckEngine'

// ─── Props ────────────────────────────────────────────────────────────────────

interface DeckProps {
  deckId: 'A' | 'B'
  track: Track | null
  audioContext: AudioContext | null
  masterGain: GainNode | null
  crossfaderGainA: GainNode | null
  crossfaderGainB: GainNode | null
  onUpdateBpm: (bpm: number) => void
  opponentBpm: number | null
  eqLowVal: number
  eqMidVal: number
  eqHighVal: number
  volumeVal: number
  onLoadTrack: (track: Track) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Deck({
  deckId,
  track,
  audioContext,
  masterGain,
  crossfaderGainA,
  crossfaderGainB,
  opponentBpm,
  eqLowVal,
  eqMidVal,
  eqHighVal,
  volumeVal,
  onLoadTrack
}: DeckProps): React.JSX.Element {
  const { t } = useLanguage()

  // ── Permanent EQ / Gain nodes (created once, live as long as the deck) ──
  //
  // These nodes form the tail of the signal chain.  The head is the
  // AudioBufferSourceNode managed inside useDeckEngine.  We pass the entry
  // node (filterLowRef) to the hook so it can connect the source to the chain.

  const filterLowRef  = useRef<BiquadFilterNode | null>(null)
  const filterMidRef  = useRef<BiquadFilterNode | null>(null)
  const filterHighRef = useRef<BiquadFilterNode | null>(null)
  const gainNodeRef   = useRef<GainNode | null>(null)

  // We expose the entry node (filterLow) to the hook via state so that the
  // hook re-runs its connection logic whenever the node is first created.
  const [filterLowNode, setFilterLowNode] = useState<BiquadFilterNode | null>(null)

  // ── Create the EQ/Gain chain once AudioContext is ready ──────────────────

  useEffect(() => {
    if (!audioContext || !masterGain || !crossfaderGainA || !crossfaderGainB) return

    // Create nodes
    const low  = audioContext.createBiquadFilter()
    const mid  = audioContext.createBiquadFilter()
    const high = audioContext.createBiquadFilter()
    const gain = audioContext.createGain()

    // Configure EQ filters
    low.type            = 'lowshelf'
    low.frequency.value = 250

    mid.type            = 'peaking'
    mid.frequency.value = 1000
    mid.Q.value         = 1.0

    high.type            = 'highshelf'
    high.frequency.value = 4000

    // Connect chain: low → mid → high → gain → crossfader → master
    low.connect(mid).connect(high).connect(gain)
    const targetCrossfader = deckId === 'A' ? crossfaderGainA : crossfaderGainB
    gain.connect(targetCrossfader)

    // Set initial values
    gain.gain.value  = volumeVal
    low.gain.setValueAtTime(eqLowVal,  audioContext.currentTime)
    mid.gain.setValueAtTime(eqMidVal,  audioContext.currentTime)
    high.gain.setValueAtTime(eqHighVal, audioContext.currentTime)

    filterLowRef.current  = low
    filterMidRef.current  = mid
    filterHighRef.current = high
    gainNodeRef.current   = gain

    // Expose entry node to the audio engine hook
    setFilterLowNode(low)

    return () => {
      try {
        low.disconnect()
        mid.disconnect()
        high.disconnect()
        gain.disconnect()
      } catch { /* safe to ignore */ }
      filterLowRef.current  = null
      filterMidRef.current  = null
      filterHighRef.current = null
      gainNodeRef.current   = null
      setFilterLowNode(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioContext, masterGain, crossfaderGainA, crossfaderGainB])

  // ── Sync EQ / Volume on prop changes (from Mixer) ────────────────────────

  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = volumeVal
  }, [volumeVal])

  useEffect(() => {
    if (filterLowRef.current && audioContext)
      filterLowRef.current.gain.setValueAtTime(eqLowVal, audioContext.currentTime)
  }, [eqLowVal, audioContext])

  useEffect(() => {
    if (filterMidRef.current && audioContext)
      filterMidRef.current.gain.setValueAtTime(eqMidVal, audioContext.currentTime)
  }, [eqMidVal, audioContext])

  useEffect(() => {
    if (filterHighRef.current && audioContext)
      filterHighRef.current.gain.setValueAtTime(eqHighVal, audioContext.currentTime)
  }, [eqHighVal, audioContext])

  // ── Audio Engine ─────────────────────────────────────────────────────────

  const engine = useDeckEngine({
    track,
    audioContext,
    filterLowNode,
    opponentBpm
  })

  // ── Waveform Canvas ───────────────────────────────────────────────────────

  const canvasRef        = useRef<HTMLCanvasElement | null>(null)
  const isScrubbingRef   = useRef(false)
  const scrubLastXRef    = useRef<number | null>(null)
  const scrubIsJogRef    = useRef(false)
  const activeColor      = deckId === 'A' ? '#a855f7' : '#9333ea'

  // Draw loop (RAF-driven, reads currentTime from engine)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || engine.decoding) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const width = canvas.width

      const scrollHeight  = 56
      const scrollCenterY = scrollHeight / 2
      const overviewY     = 64
      const overviewHeight = 16
      const overviewCenterY = overviewY + overviewHeight / 2

      // Center playhead line
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath()
      ctx.moveTo(width / 2, 0)
      ctx.lineTo(width / 2, scrollHeight)
      ctx.stroke()

      const progress = engine.duration > 0 ? engine.currentTime / engine.duration : 0

      if (engine.peaks.length > 0 && engine.duration > 0) {
        // ── Scrolling waveform ──────────────────────────────────────────
        const centerIndex = progress * engine.peaks.length
        const span        = 80
        const start       = centerIndex - span / 2
        const firstVisible = Math.max(0, Math.floor(start))
        const lastVisible  = Math.min(engine.peaks.length - 1, Math.ceil(centerIndex + span / 2))

        ctx.lineWidth = 3
        ctx.lineCap   = 'round'

        for (let i = firstVisible; i <= lastVisible; i++) {
          const x         = ((i - start) / span) * width
          const peakValue = engine.peaks[i] || 0
          ctx.strokeStyle = i < centerIndex ? activeColor : '#3f3f46'
          const h = peakValue * scrollHeight * 0.95
          ctx.beginPath()
          ctx.moveTo(x, scrollCenterY - h / 2)
          ctx.lineTo(x, scrollCenterY + h / 2)
          ctx.stroke()
        }

        // ── Loop markers on scrolling waveform ──────────────────────────
        if (engine.loopStart !== null && engine.loopEnd !== null) {
          const startIdx = (engine.loopStart / engine.duration) * engine.peaks.length
          const endIdx   = (engine.loopEnd   / engine.duration) * engine.peaks.length
          const startX   = ((startIdx - start) / span) * width
          const endX     = ((endIdx   - start) / span) * width

          ctx.fillStyle = 'rgba(168,85,247,0.15)'
          ctx.fillRect(startX, 0, endX - startX, scrollHeight)
          ctx.strokeStyle = '#d8b4fe'
          ctx.lineWidth   = 1.5
          ctx.beginPath()
          ctx.moveTo(startX, 0); ctx.lineTo(startX, scrollHeight)
          ctx.moveTo(endX,   0); ctx.lineTo(endX,   scrollHeight)
          ctx.stroke()
        }

        // ── Cue point marker on scrolling waveform ──────────────────────
        if (engine.cueTime !== null) {
          const cueIdx = (engine.cueTime / engine.duration) * engine.peaks.length
          const cueX   = ((cueIdx - start) / span) * width
          if (cueX >= 0 && cueX <= width) {
            ctx.strokeStyle = '#22c55e'
            ctx.lineWidth   = 2
            ctx.beginPath()
            ctx.moveTo(cueX, 0); ctx.lineTo(cueX, scrollHeight)
            ctx.stroke()
            ctx.fillStyle = '#22c55e'
            ctx.beginPath()
            ctx.moveTo(cueX, 0)
            ctx.lineTo(cueX + 7, 0)
            ctx.lineTo(cueX, 10)
            ctx.closePath()
            ctx.fill()
          }
        }

        // ── Overview waveform ────────────────────────────────────────────
        ctx.fillStyle = 'rgba(24,24,27,0.6)'
        ctx.fillRect(0, overviewY, width, overviewHeight)

        ctx.lineWidth = 1.5
        ctx.lineCap   = 'butt'
        for (let x = 0; x < width; x += 2) {
          const peakIdx   = Math.floor((x / width) * engine.peaks.length)
          const peakValue = engine.peaks[peakIdx] || 0
          const h         = peakValue * (overviewHeight - 4)
          ctx.strokeStyle = x < progress * width
            ? (activeColor === '#a855f7' ? '#c084fc' : '#a855f7')
            : '#52525b'
          ctx.beginPath()
          ctx.moveTo(x, overviewCenterY - h / 2)
          ctx.lineTo(x, overviewCenterY + h / 2)
          ctx.stroke()
        }

        // Overview playhead
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth   = 2
        ctx.beginPath()
        ctx.moveTo(progress * width, overviewY)
        ctx.lineTo(progress * width, overviewY + overviewHeight)
        ctx.stroke()

        // Cue on overview
        if (engine.cueTime !== null) {
          const cueX = (engine.cueTime / engine.duration) * width
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth   = 1.5
          ctx.beginPath()
          ctx.moveTo(cueX, overviewY); ctx.lineTo(cueX, overviewY + overviewHeight)
          ctx.stroke()
        }
      } else {
        // Empty state – flat line
        ctx.strokeStyle = '#27272a'
        ctx.lineWidth   = 2
        ctx.beginPath()
        ctx.moveTo(0, scrollCenterY); ctx.lineTo(width, scrollCenterY)
        ctx.stroke()
        if (engine.decoding) {
          ctx.fillStyle = '#a1a1aa'
          ctx.font      = '10px sans-serif'
          ctx.fillText(t('deck.loadingWaveform'), 12, scrollCenterY - 8)
        }
      }

      rafId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafId)
  }, [engine.peaks, engine.duration, engine.decoding, engine.loopStart, engine.loopEnd, engine.cueTime, engine.currentTime, activeColor, t])

  // ── Waveform interaction (scrubbing / seeking) ────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    const canvas = canvasRef.current
    if (!canvas || !track || engine.duration <= 0 || engine.peaks.length === 0) return

    const rect    = canvas.getBoundingClientRect()
    const scaleY  = canvas.height / rect.height
    const y       = (e.clientY - rect.top) * scaleY
    const isOverview = y > canvas.height * 0.75

    isScrubbingRef.current = true
    scrubIsJogRef.current  = !isOverview
    scrubLastXRef.current  = e.clientX

    if (isOverview) {
      const scaleX = canvas.width / rect.width
      const x      = (e.clientX - rect.left) * scaleX
      engine.seek((x / canvas.width) * engine.duration)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isScrubbingRef.current || !track || engine.duration <= 0 || engine.peaks.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const prevX = scrubLastXRef.current
    if (prevX === null) { scrubLastXRef.current = e.clientX; return }

    const deltaCSS = e.clientX - prevX
    scrubLastXRef.current = e.clientX

    if (scrubIsJogRef.current) {
      const rect          = canvas.getBoundingClientRect()
      const scaleX        = canvas.width / rect.width
      const deltaPx       = deltaCSS * scaleX
      const span          = 80
      const secondsPerPeak = engine.duration / engine.peaks.length
      const deltaTime     = (deltaPx / canvas.width) * span * secondsPerPeak
      engine.seek(engine.currentTime + deltaTime)
    } else {
      const rect  = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const x     = (e.clientX - rect.left) * scaleX
      engine.seek((x / canvas.width) * engine.duration)
    }
  }

  const handleMouseUpOrLeave = () => {
    isScrubbingRef.current = false
    scrubLastXRef.current  = null
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    const allowed = e.dataTransfer.effectAllowed
    e.dataTransfer.dropEffect = (allowed === 'move' || allowed === 'copyMove' || allowed === 'all') ? 'move' : 'copy'
    setIsDragOver(true)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const dataStr = e.dataTransfer.getData('text/plain')
      if (dataStr) onLoadTrack(JSON.parse(dataStr) as Track)
    } catch (err) {
      console.error('Failed to parse dropped track:', err)
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const currentBpm = track && track.bpm > 0 ? Math.round(track.bpm * engine.pitch) : 0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col border p-4 rounded-xl shadow-lg relative select-none w-[420px] transition-all duration-200 ${
        isDragOver
          ? deckId === 'A'
            ? 'border-primary ring-2 ring-primary/20 bg-primary/5 scale-[1.01]'
            : 'border-purple-600 ring-2 ring-purple-600/20 bg-purple-600/5 scale-[1.01]'
          : 'border-zinc-900 bg-zinc-950'
      } ${deckId === 'A' ? 'border-l-primary/30' : 'border-r-primary/30'}`}
    >
      {/* ── Deck Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="truncate max-w-[240px]">
          <div className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">DECK {deckId}</div>
          <div className="text-sm font-bold text-zinc-200 truncate">
            {track ? track.title : t('deck.noTrackLoaded')}
          </div>
          <div className="text-xs text-zinc-500 truncate">{track ? track.artist : '---'}</div>
        </div>

        {/* BPM & Time */}
        <div className="text-right">
          <div className="text-lg font-black text-primary font-mono leading-none">
            {currentBpm > 0 ? currentBpm : '0.0'}
            <span className="text-[10px] font-normal text-zinc-600 ml-1">BPM</span>
          </div>
          {track && track.bpm > 0 && Math.abs(engine.pitch - 1.0) > 0.001 && (
            <div className="text-[10px] font-mono text-zinc-500">
              Orig: {track.bpm} ({((engine.pitch - 1.0) * 100).toFixed(1)}%)
            </div>
          )}
          <div className="mt-1 text-sm font-bold text-zinc-300 font-mono leading-none">
            {track ? formatDuration(Math.max(0, engine.duration - engine.currentTime)) : '0:00'}
            <span className="text-[9px] font-semibold text-zinc-600 ml-1 uppercase">Rem</span>
          </div>
        </div>
      </div>

      {/* ── Waveform ─────────────────────────────────────────────────────── */}
      <div className="relative my-3 h-20 w-full overflow-hidden rounded-lg bg-zinc-900/50 border border-zinc-900">
        <canvas
          ref={canvasRef}
          width={400}
          height={80}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="absolute inset-0 h-full w-full cursor-pointer"
        />
        {/* Decoding indicator */}
        {engine.decoding && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 rounded-lg">
            <span className="text-[10px] text-zinc-400 animate-pulse">{t('deck.loadingWaveform')}</span>
          </div>
        )}
        {/* Timing overlay */}
        <div className="absolute bottom-1 right-2 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400">
          {formatDuration(engine.currentTime)} / {formatDuration(engine.duration)}
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-3 pt-2">

        {/* LEFT: Play, Cue, Sync, Loop */}
        <div className="col-span-8 space-y-3">

          {/* Play / Cue row */}
          <div className="flex gap-2">
            <button
              onClick={engine.togglePlay}
              disabled={!track || !filterLowNode}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 font-bold transition duration-150 ${
                engine.isPlaying
                  ? 'bg-zinc-800 text-primary hover:bg-zinc-700'
                  : 'bg-primary text-white hover:bg-primary/95 shadow-md shadow-primary/10'
              } disabled:opacity-30`}
            >
              {engine.isPlaying
                ? <><Pause className="h-4 w-4 fill-current" /> Pause</>
                : <><Play  className="h-4 w-4 fill-current" /> Play</>
              }
            </button>

            <button
              onMouseDown={engine.handleCueMouseDown}
              onMouseUp={engine.handleCueMouseUp}
              onMouseLeave={engine.handleCueMouseUp}
              disabled={!track || !filterLowNode}
              className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white font-bold py-2.5 text-center transition disabled:opacity-30 select-none"
            >
              CUE
            </button>
          </div>

          {/* Set Cue / Sync row */}
          <div className="flex gap-2">
            <button
              onClick={engine.setCuePoint}
              disabled={!track || !filterLowNode}
              title={t('deck.setCueTooltip')}
              className="flex-1 text-center py-1.5 rounded bg-zinc-900 text-xs font-semibold text-zinc-400 border border-zinc-900 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
            >
              Set Cue
            </button>
            <button
              onClick={engine.handleSync}
              disabled={!track || !opponentBpm || opponentBpm === 0 || !filterLowNode}
              className="flex-1 text-center py-1.5 rounded bg-amber-600/10 hover:bg-amber-600/20 text-xs font-bold text-amber-500 border border-amber-600/30 transition disabled:opacity-30"
            >
              SYNC
            </button>
          </div>

          {/* Beat Loop buttons */}
          <div className="space-y-1.5 border-t border-zinc-900/60 pt-2.5">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              {t('deck.autoloop')}
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 4, 8].map((beats) => (
                <button
                  key={beats}
                  onClick={() => engine.handleBeatLoop(beats)}
                  disabled={!track || !track.bpm || !filterLowNode}
                  className={`flex-1 text-xs font-bold py-1.5 rounded transition ${
                    engine.activeLoopBeats === beats
                      ? 'bg-primary text-white font-black'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-900 hover:bg-zinc-800 hover:text-zinc-200'
                  } disabled:opacity-30`}
                >
                  {beats}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Pitch slider & Key Lock */}
        <div className="col-span-4 flex flex-col items-center border-l border-zinc-900 pl-3">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">PITCH</div>
          <div className="flex-1 flex items-center justify-center relative w-full h-[100px]">
            <input
              type="range"
              min="0.84"
              max="1.16"
              step="0.001"
              value={engine.pitch}
              onChange={(e) => engine.handlePitchChange(parseFloat(e.target.value))}
              disabled={!track || !filterLowNode}
              className="absolute accent-primary h-2 w-[100px] cursor-pointer rotate-270 bg-zinc-900 rounded-lg outline-none"
            />
          </div>

          {/* Key Lock toggle */}
          <button
            onClick={engine.toggleKeyLock}
            disabled={!track || !filterLowNode}
            className={`mt-2 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition ${
              engine.keyLock
                ? 'bg-zinc-900 text-primary border border-primary/30'
                : 'bg-zinc-950 text-zinc-500 border border-zinc-900'
            } disabled:opacity-30`}
          >
            {engine.keyLock
              ? <><Lock   className="h-3 w-3" /> KeyLock</>
              : <><Unlock className="h-3 w-3" /> KeyLock</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
