import React, { useRef, useEffect } from 'react'
import type { Track } from '@main/db'
import { formatDuration } from '@renderer/utils/audio'
import { useLanguage } from '@renderer/i18n'
import {
  preRenderScrollWaveform,
  preRenderOverviewWaveform,
  drawLoopMarkers,
  drawCueMarker,
  drawMainPlayhead,
  drawOverviewWaveform,
  drawOverviewPlayhead,
  drawOverviewCue
} from './waveformDrawHelpers'

interface WaveformCanvasProps {
  deckId: 'A' | 'B'
  track: Track | null
  peaks: number[]
  duration: number
  decoding: boolean
  loopStart: number | null
  loopEnd: number | null
  cueTime: number | null
  getCurrentTime: () => number
  seek: (time: number) => void
  timeRemainingRef: React.RefObject<HTMLSpanElement | null>
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  deckId,
  track,
  peaks,
  duration,
  decoding,
  loopStart,
  loopEnd,
  cueTime,
  getCurrentTime,
  seek,
  timeRemainingRef
}) => {
  const { t } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const timeOverlayRef = useRef<HTMLDivElement | null>(null)
  const isScrubbingRef = useRef(false)
  const scrubLastXRef = useRef<number | null>(null)
  const scrubIsJogRef = useRef(false)
  const activeColor = deckId === 'A' ? '#a855f7' : '#9333ea'

  // Pre-rendered offscreen canvases
  const offscreenScrollPlayedRef = useRef<HTMLCanvasElement | null>(null)
  const offscreenScrollUnplayedRef = useRef<HTMLCanvasElement | null>(null)
  const offscreenOverviewPlayedRef = useRef<HTMLCanvasElement | null>(null)
  const offscreenOverviewUnplayedRef = useRef<HTMLCanvasElement | null>(null)

  // Pre-render scrolling and overview waveforms onto offscreen canvases
  useEffect(() => {
    if (peaks.length === 0 || duration <= 0) {
      offscreenScrollPlayedRef.current = null
      offscreenScrollUnplayedRef.current = null
      offscreenOverviewPlayedRef.current = null
      offscreenOverviewUnplayedRef.current = null
      return
    }

    const width = 400
    const scrollHeight = 56
    const overviewHeight = 16

    const span = 80
    const peakWidth = width / span
    const scrollCanvasWidth = peaks.length * peakWidth + width

    // 1. Scroll Played Canvas
    offscreenScrollPlayedRef.current = preRenderScrollWaveform(
      peaks,
      scrollCanvasWidth,
      scrollHeight,
      peakWidth,
      width,
      activeColor
    )

    // 2. Scroll Unplayed Canvas
    offscreenScrollUnplayedRef.current = preRenderScrollWaveform(
      peaks,
      scrollCanvasWidth,
      scrollHeight,
      peakWidth,
      width,
      '#3f3f46'
    )

    // 3. Overview Played Canvas
    const playedColor = activeColor === '#a855f7' ? '#c084fc' : '#a855f7'
    offscreenOverviewPlayedRef.current = preRenderOverviewWaveform(
      peaks,
      width,
      overviewHeight,
      playedColor
    )

    // 4. Overview Unplayed Canvas
    offscreenOverviewUnplayedRef.current = preRenderOverviewWaveform(
      peaks,
      width,
      overviewHeight,
      '#52525b'
    )
  }, [peaks, duration, activeColor])

  // Draw loop (RAF-driven, reads time dynamically, hardware-accelerated drawing)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || decoding) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number

    const draw = (): void => {
      const curTime = getCurrentTime()

      // Direct DOM updates for real-time text components to avoid React re-renders
      if (timeRemainingRef.current) {
        timeRemainingRef.current.textContent = formatDuration(Math.max(0, duration - curTime))
      }
      if (timeOverlayRef.current) {
        timeOverlayRef.current.textContent = `${formatDuration(curTime)} / ${formatDuration(duration)}`
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const width = canvas.width

      const scrollHeight = 56
      const scrollCenterY = scrollHeight / 2
      const overviewY = 64
      const overviewHeight = 16

      const progress = duration > 0 ? curTime / duration : 0

      const scrollPlayed = offscreenScrollPlayedRef.current
      const scrollUnplayed = offscreenScrollUnplayedRef.current
      const overviewPlayed = offscreenOverviewPlayedRef.current
      const overviewUnplayed = offscreenOverviewUnplayedRef.current

      if (scrollPlayed && scrollUnplayed && overviewPlayed && overviewUnplayed && duration > 0) {
        const span = 80
        const peakWidth = width / span
        const totalScrollWidth = peaks.length * peakWidth
        const sx = progress * totalScrollWidth

        // ── Scrolling waveform ──────────────────────────────────────────
        // 1. Draw unplayed scrolling waveform
        ctx.drawImage(scrollUnplayed, sx, 0, width, scrollHeight, 0, 0, width, scrollHeight)
        // 2. Overlay played scrolling waveform on the left half (up to width / 2)
        ctx.drawImage(scrollPlayed, sx, 0, width / 2, scrollHeight, 0, 0, width / 2, scrollHeight)

        // ── Loop markers on scrolling waveform ──────────────────────────
        if (loopStart !== null && loopEnd !== null) {
          drawLoopMarkers(ctx, {
            loopStart,
            loopEnd,
            duration,
            peaksLength: peaks.length,
            peakWidth,
            sx,
            width,
            scrollHeight
          })
        }

        // ── Cue point marker on scrolling waveform ──────────────────────
        if (cueTime !== null) {
          drawCueMarker(ctx, {
            cueTime,
            duration,
            peaksLength: peaks.length,
            peakWidth,
            sx,
            width,
            scrollHeight
          })
        }

        // ── Center playhead line on scrolling waveform ──────────────────
        // Drawn on top of the scrolling waveform, loop, and cue markers for maximum visibility
        drawMainPlayhead(ctx, { width, scrollHeight })

        // ── Overview waveform ────────────────────────────────────────────
        drawOverviewWaveform(ctx, {
          overviewUnplayed,
          overviewPlayed,
          progress,
          width,
          overviewY,
          overviewHeight
        })

        // Overview playhead
        drawOverviewPlayhead(ctx, { progress, width, overviewY, overviewHeight })

        // Cue on overview
        if (cueTime !== null) {
          drawOverviewCue(ctx, { cueTime, duration, width, overviewY, overviewHeight })
        }
      } else {
        // Empty state – flat line
        ctx.strokeStyle = '#27272a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(0, scrollCenterY)
        ctx.lineTo(width, scrollCenterY)
        ctx.stroke()
        if (decoding) {
          ctx.fillStyle = '#a1a1aa'
          ctx.font = '10px sans-serif'
          ctx.fillText(t('deck.loadingWaveform'), 12, scrollCenterY - 8)
        }
      }

      rafId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafId)
  }, [
    peaks,
    duration,
    decoding,
    loopStart,
    loopEnd,
    cueTime,
    activeColor,
    getCurrentTime,
    timeRemainingRef,
    t
  ])

  // ── Waveform interaction (scrubbing / seeking) ────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (e.button !== 0) return
    const canvas = canvasRef.current
    if (!canvas || !track || duration <= 0 || peaks.length === 0) return

    const rect = canvas.getBoundingClientRect()
    const scaleY = canvas.height / rect.height
    const y = (e.clientY - rect.top) * scaleY
    const isOverview = y > canvas.height * 0.75

    isScrubbingRef.current = true
    scrubIsJogRef.current = !isOverview
    scrubLastXRef.current = e.clientX

    if (isOverview) {
      const scaleX = canvas.width / rect.width
      const x = (e.clientX - rect.left) * scaleX
      seek((x / canvas.width) * duration)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!isScrubbingRef.current || !track || duration <= 0 || peaks.length === 0) return
    const canvas = canvasRef.current
    if (!canvas) return

    const prevX = scrubLastXRef.current
    if (prevX === null) {
      scrubLastXRef.current = e.clientX
      return
    }

    const deltaCSS = e.clientX - prevX
    scrubLastXRef.current = e.clientX

    if (scrubIsJogRef.current) {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const deltaPx = deltaCSS * scaleX
      const span = 80
      const secondsPerPeak = duration / peaks.length
      const deltaTime = (deltaPx / canvas.width) * span * secondsPerPeak
      seek(getCurrentTime() + deltaTime)
    } else {
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const x = (e.clientX - rect.left) * scaleX
      seek((x / canvas.width) * duration)
    }
  }

  const handleMouseUpOrLeave = (): void => {
    isScrubbingRef.current = false
    scrubLastXRef.current = null
  }

  return (
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
      {decoding && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 rounded-lg">
          <span className="text-[10px] text-zinc-400 animate-pulse">
            {t('deck.loadingWaveform')}
          </span>
        </div>
      )}
      {/* Timing overlay */}
      <div
        ref={timeOverlayRef}
        className="absolute bottom-1 right-2 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400"
      >
        {track
          ? `${formatDuration(getCurrentTime())} / ${formatDuration(duration)}`
          : '0:00 / 0:00'}
      </div>
    </div>
  )
}

export default WaveformCanvas
