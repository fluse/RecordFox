import { spawn } from 'child_process'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'

// ─── Krumhansl-Schmuckler Key Profiles ───────────────────────────────────────
// These represent the perceptual salience of each pitch class in a key.
// Major and minor profiles from Krumhansl (1990), "Cognitive Foundations of Musical Pitch".
const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

// ─── Note name mapping (12 pitch classes starting at C) ──────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// ─── Camelot Wheel ──────────────────────────────────────────────────────────
// Maps "<root> <mode>" → Camelot code (used by Rekordbox, Mixed In Key, etc.)
const CAMELOT: Record<string, string> = {
  'C major':  '8B',  'A minor':  '8A',
  'G major':  '9B',  'E minor':  '9A',
  'D major':  '10B', 'B minor':  '10A',
  'A major':  '11B', 'F# minor': '11A',
  'E major':  '12B', 'C# minor': '12A',
  'B major':  '1B',  'G# minor': '1A',
  'F# major': '2B',  'D# minor': '2A',
  'C# major': '3B',  'A# minor': '3A',
  'G# major': '4B',  'F minor':  '4A',
  'D# major': '5B',  'C minor':  '5A',
  'A# major': '6B',  'G minor':  '6A',
  'F major':  '7B',  'D minor':  '7A',
}

// Standard ID3-TKEY notation (e.g. "Am", "F#m", "C") for writing to MP3 tags
const TKEY_NOTATION: Record<string, string> = {
  'C major': 'C',   'A minor': 'Am',
  'G major': 'G',   'E minor': 'Em',
  'D major': 'D',   'B minor': 'Bm',
  'A major': 'A',   'F# minor': 'F#m',
  'E major': 'E',   'C# minor': 'C#m',
  'B major': 'B',   'G# minor': 'G#m',
  'F# major': 'F#', 'D# minor': 'D#m',
  'C# major': 'C#', 'A# minor': 'A#m',
  'G# major': 'G#', 'F minor': 'Fm',
  'D# major': 'D#', 'C minor': 'Cm',
  'A# major': 'A#', 'G minor': 'Gm',
  'F major': 'F',   'D minor': 'Dm',
}

/**
 * Returns the Camelot color (hue in degrees) for a Camelot code like "8B", "3A".
 * Useful for color-coding in the UI.
 */
export function camelotColor(camelot: string): string {
  const num = parseInt(camelot)
  if (isNaN(num)) return '#71717a'
  // Map 1–12 to a smooth color wheel (HSL)
  const hue = ((num - 1) / 12) * 360
  return `hsl(${hue}, 70%, 55%)`
}

/**
 * Analyzes the musical key of an audio file.
 * Returns the Camelot notation (e.g. "8A", "10B") and the ID3 TKEY value.
 */
export async function analyzeKey(filepath: string): Promise<{ camelot: string; tkey: string }> {
  const SAMPLE_RATE = 22050
  const TOTAL_SAMPLES = SAMPLE_RATE * 60 // Analyze up to 60 seconds

  const pcmData = await decodeToPcm(filepath, SAMPLE_RATE, TOTAL_SAMPLES)

  if (pcmData.length < SAMPLE_RATE * 4) {
    return { camelot: '', tkey: '' }
  }

  const { camelot, tkey } = detectKey(pcmData, SAMPLE_RATE)
  return { camelot, tkey }
}

// ─── FFmpeg PCM Decoder (reusable) ───────────────────────────────────────────

function decodeToPcm(filepath: string, sampleRate: number, maxSamples: number): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', filepath,
      '-f', 'f32le',
      '-ac', '1',
      '-ar', String(sampleRate),
      '-t', '60',
      'pipe:1'
    ]

    const ffmpeg = spawn(ffmpegPath.path, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []
    let totalBytes = 0
    const maxBytes = maxSamples * 4

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      if (totalBytes < maxBytes) {
        const remaining = maxBytes - totalBytes
        chunks.push(chunk.length > remaining ? chunk.slice(0, remaining) : chunk)
        totalBytes += Math.min(chunk.length, remaining)
      }
    })

    ffmpeg.on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
    ffmpeg.on('close', (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`FFmpeg exited with code ${code}`))
        return
      }
      const combined = Buffer.concat(chunks)
      resolve(new Float32Array(combined.buffer, combined.byteOffset, combined.length / 4))
    })
  })
}

// ─── Chromagram via Goertzel Algorithm ───────────────────────────────────────

/**
 * Computes the energy at a specific frequency using the Goertzel algorithm.
 * This is an efficient DFT for a single frequency – O(N) instead of O(N log N).
 */
function goertzel(samples: Float32Array, targetFreq: number, sampleRate: number): number {
  const N = samples.length
  const normalizedFreq = targetFreq / sampleRate
  const omega = 2 * Math.PI * normalizedFreq
  const coeff = 2 * Math.cos(omega)

  let q0 = 0, q1 = 0, q2 = 0
  for (let i = 0; i < N; i++) {
    q0 = coeff * q1 - q2 + samples[i]
    q2 = q1
    q1 = q0
  }

  return q1 * q1 + q2 * q2 - q1 * q2 * coeff
}

/**
 * Computes the 12-dimensional chromagram (pitch class profile) of the audio.
 * For each of the 12 pitch classes, energy is summed across 5 octaves using
 * the Goertzel algorithm. This creates a pitch-class histogram independent of octave.
 */
function computeChroma(samples: Float32Array, sampleRate: number): Float64Array {
  // Reference frequencies for C2–B2 (will be multiplied per octave)
  const C2 = 65.406
  const SEMITONE = Math.pow(2, 1 / 12)

  // Analyze in overlapping blocks for temporal averaging
  const BLOCK = 8192
  const HOP   = 4096
  const OCTAVES = [0, 1, 2, 3, 4] // C2–B6

  const chroma = new Float64Array(12)
  let numBlocks = 0

  for (let start = 0; start + BLOCK <= samples.length; start += HOP) {
    const block = samples.slice(start, start + BLOCK)

    for (let pc = 0; pc < 12; pc++) {
      for (const oct of OCTAVES) {
        const freq = C2 * Math.pow(SEMITONE, pc) * Math.pow(2, oct)
        if (freq >= sampleRate / 2) continue // above Nyquist
        chroma[pc] += goertzel(block, freq, sampleRate)
      }
    }
    numBlocks++
  }

  // Normalize chroma to [0, 1]
  let maxVal = 0
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > maxVal) maxVal = chroma[i]
  }
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= maxVal
  }

  return chroma
}

// ─── Krumhansl-Schmuckler Key Finder ─────────────────────────────────────────

/**
 * Computes the Pearson correlation between two arrays.
 */
function pearson(a: ArrayLike<number>, b: number[]): number {
  const n = Math.min(a.length, b.length)
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0

  for (let i = 0; i < n; i++) {
    sumA  += a[i]
    sumB  += b[i]
    sumAB += a[i] * b[i]
    sumA2 += a[i] * a[i]
    sumB2 += b[i] * b[i]
  }

  const meanA = sumA / n
  const meanB = sumB / n
  const num   = sumAB - n * meanA * meanB
  const den   = Math.sqrt((sumA2 - n * meanA * meanA) * (sumB2 - n * meanB * meanB))

  return den === 0 ? 0 : num / den
}

/**
 * Detects the musical key by comparing the chromagram against all 24 major/minor
 * Krumhansl-Schmuckler profiles, then returns the Camelot and TKEY representations.
 */
function detectKey(samples: Float32Array, sampleRate: number): { camelot: string; tkey: string } {
  const chroma = computeChroma(samples, sampleRate)

  let bestLabel = 'C major'
  let bestCorr  = -Infinity

  for (let root = 0; root < 12; root++) {
    // Rotate profiles so index 0 = root
    const majorProfile = KS_MAJOR.map((_, i) => KS_MAJOR[(i + 12 - root) % 12])
    const minorProfile = KS_MINOR.map((_, i) => KS_MINOR[(i + 12 - root) % 12])

    const corrMajor = pearson(chroma, majorProfile)
    const corrMinor = pearson(chroma, minorProfile)

    const noteName = NOTE_NAMES[root]

    if (corrMajor > bestCorr) {
      bestCorr  = corrMajor
      bestLabel = `${noteName} major`
    }
    if (corrMinor > bestCorr) {
      bestCorr  = corrMinor
      bestLabel = `${noteName} minor`
    }
  }

  return {
    camelot: CAMELOT[bestLabel]  ?? '',
    tkey:    TKEY_NOTATION[bestLabel] ?? ''
  }
}
