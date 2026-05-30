/**
 * Helper functions for pre-rendering and drawing waveforms and markers on canvas.
 */

/**
 * Pre-renders a scrolling waveform to an offscreen canvas.
 */
export function preRenderScrollWaveform(
  peaks: number[],
  canvasWidth: number,
  scrollHeight: number,
  peakWidth: number,
  waveformWidth: number,
  color: string
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = scrollHeight
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = color
    const scrollCenterY = scrollHeight / 2
    for (let i = 0; i < peaks.length; i++) {
      const x = waveformWidth / 2 + i * peakWidth
      const peakValue = peaks[i] || 0
      const h = peakValue * scrollHeight * 0.95
      ctx.beginPath()
      ctx.moveTo(x, scrollCenterY - h / 2)
      ctx.lineTo(x, scrollCenterY + h / 2)
      ctx.stroke()
    }
  }
  return canvas
}

/**
 * Pre-renders an overview waveform to an offscreen canvas.
 */
export function preRenderOverviewWaveform(
  peaks: number[],
  width: number,
  overviewHeight: number,
  color: string
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = overviewHeight
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.lineWidth = 1.5
    ctx.lineCap = 'butt'
    ctx.strokeStyle = color
    const overviewCenterY = overviewHeight / 2
    for (let x = 0; x < width; x += 2) {
      const peakIdx = Math.floor((x / width) * peaks.length)
      const peakValue = peaks[peakIdx] || 0
      const h = peakValue * (overviewHeight - 4)
      ctx.beginPath()
      ctx.moveTo(x, overviewCenterY - h / 2)
      ctx.lineTo(x, overviewCenterY + h / 2)
      ctx.stroke()
    }
  }
  return canvas
}

/**
 * Draws the loop range overlay and markers on the scrolling waveform.
 */
interface DrawLoopMarkersParams {
  loopStart: number
  loopEnd: number
  duration: number
  peaksLength: number
  peakWidth: number
  sx: number
  width: number
  scrollHeight: number
}

export function drawLoopMarkers(
  ctx: CanvasRenderingContext2D,
  params: DrawLoopMarkersParams
): void {
  const { loopStart, loopEnd, duration, peaksLength, peakWidth, sx, width, scrollHeight } = params
  const startIdx = (loopStart / duration) * peaksLength
  const endIdx = (loopEnd / duration) * peaksLength
  const startX = width / 2 + startIdx * peakWidth - sx
  const endX = width / 2 + endIdx * peakWidth - sx

  ctx.fillStyle = 'rgba(168, 85, 247, 0.15)'
  ctx.fillRect(startX, 0, endX - startX, scrollHeight)
  ctx.strokeStyle = '#d8b4fe'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(startX, 0)
  ctx.lineTo(startX, scrollHeight)
  ctx.moveTo(endX, 0)
  ctx.lineTo(endX, scrollHeight)
  ctx.stroke()
}

/**
 * Draws the green cue marker on the scrolling waveform.
 */
interface DrawCueMarkerParams {
  cueTime: number
  duration: number
  peaksLength: number
  peakWidth: number
  sx: number
  width: number
  scrollHeight: number
}

export function drawCueMarker(ctx: CanvasRenderingContext2D, params: DrawCueMarkerParams): void {
  const { cueTime, duration, peaksLength, peakWidth, sx, width, scrollHeight } = params
  const cueIdx = (cueTime / duration) * peaksLength
  const cueX = width / 2 + cueIdx * peakWidth - sx
  if (cueX >= 0 && cueX <= width) {
    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cueX, 0)
    ctx.lineTo(cueX, scrollHeight)
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

/**
 * Draws the red center playhead line and top/bottom indicators on the scrolling waveform.
 */
interface DrawMainPlayheadParams {
  width: number
  scrollHeight: number
}

export function drawMainPlayhead(
  ctx: CanvasRenderingContext2D,
  params: DrawMainPlayheadParams
): void {
  const { width, scrollHeight } = params
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(width / 2, 0)
  ctx.lineTo(width / 2, scrollHeight)
  ctx.stroke()

  // Draw small red triangles at the top and bottom of the playhead to make it highly visible
  ctx.fillStyle = '#ef4444'
  // Top triangle
  ctx.beginPath()
  ctx.moveTo(width / 2 - 4, 0)
  ctx.lineTo(width / 2 + 4, 0)
  ctx.lineTo(width / 2, 5)
  ctx.closePath()
  ctx.fill()

  // Bottom triangle
  ctx.beginPath()
  ctx.moveTo(width / 2 - 4, scrollHeight)
  ctx.lineTo(width / 2 + 4, scrollHeight)
  ctx.lineTo(width / 2, scrollHeight - 5)
  ctx.closePath()
  ctx.fill()
}

/**
 * Draws the overview waveform background, unplayed background, and played overlay.
 */
interface DrawOverviewWaveformParams {
  overviewUnplayed: HTMLCanvasElement
  overviewPlayed: HTMLCanvasElement
  progress: number
  width: number
  overviewY: number
  overviewHeight: number
}

export function drawOverviewWaveform(
  ctx: CanvasRenderingContext2D,
  params: DrawOverviewWaveformParams
): void {
  const { overviewUnplayed, overviewPlayed, progress, width, overviewY, overviewHeight } = params
  ctx.fillStyle = 'rgba(24, 24, 27, 0.6)'
  ctx.fillRect(0, overviewY, width, overviewHeight)

  // 1. Draw unplayed overview
  ctx.drawImage(overviewUnplayed, 0, overviewY)
  // 2. Draw played overview up to progress
  if (progress > 0) {
    ctx.drawImage(
      overviewPlayed,
      0,
      0,
      progress * width,
      overviewHeight,
      0,
      overviewY,
      progress * width,
      overviewHeight
    )
  }
}

/**
 * Draws the red playhead line on the overview waveform.
 */
interface DrawOverviewPlayheadParams {
  progress: number
  width: number
  overviewY: number
  overviewHeight: number
}

export function drawOverviewPlayhead(
  ctx: CanvasRenderingContext2D,
  params: DrawOverviewPlayheadParams
): void {
  const { progress, width, overviewY, overviewHeight } = params
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(progress * width, overviewY)
  ctx.lineTo(progress * width, overviewY + overviewHeight)
  ctx.stroke()
}

/**
 * Draws the green cue marker on the overview waveform.
 */
interface DrawOverviewCueParams {
  cueTime: number
  duration: number
  width: number
  overviewY: number
  overviewHeight: number
}

export function drawOverviewCue(
  ctx: CanvasRenderingContext2D,
  params: DrawOverviewCueParams
): void {
  const { cueTime, duration, width, overviewY, overviewHeight } = params
  const cueX = (cueTime / duration) * width
  ctx.strokeStyle = '#22c55e'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(cueX, overviewY)
  ctx.lineTo(cueX, overviewY + overviewHeight)
  ctx.stroke()
}
