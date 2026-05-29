import { useState, useEffect, useRef } from 'react'
import type { Track } from '@main/db'
import { calculateBpm } from '../utils/audio'

export function useTrackScanner(
  tracks: Track[],
  playlistId: string,
  onUpdateBpm: (trackId: string, bpm: number) => void,
  onUpdateKey: (trackId: string, key: string) => void
): Record<string, boolean> {
  const [scanningBpm, setScanningBpm] = useState<Record<string, boolean>>({})

  const scannedRef = useRef<Set<string>>(new Set())
  const isScanningRef = useRef(false)
  const scannedKeyRef = useRef<Set<string>>(new Set())
  const isScanningKeyRef = useRef(false)

  // Clear scanned list when selected playlist changes so tracks can be retried
  useEffect((): void => {
    scannedRef.current.clear()
    isScanningRef.current = false
    scannedKeyRef.current.clear()
    isScanningKeyRef.current = false
  }, [playlistId])

  // Auto-scan tracks with BPM = 0 when the playlist is displayed.
  useEffect((): void => {
    if (isScanningRef.current) return

    const scanMissingBpm = async (): Promise<void> => {
      isScanningRef.current = true
      try {
        while (true) {
          const trackToScan = tracks.find(
            (t) => t.bpm === 0 && t.filepath && !scannedRef.current.has(t.id)
          )
          if (!trackToScan) break

          const trackId = trackToScan.id
          scannedRef.current.add(trackId)
          setScanningBpm((prev) => ({ ...prev, [trackId]: true }))

          try {
            // Primary: use main-process BPM analyzer (FFmpeg-based)
            const result = await window.api.analyzeTrackBpm(
              trackId,
              playlistId,
              trackToScan.filepath
            )
            if (result.success && result.bpm && result.bpm > 0) {
              onUpdateBpm(trackId, result.bpm)
            } else {
              // Fallback: in-renderer music-tempo
              console.log(
                `[BPM] Main process returned no BPM for ${trackToScan.title}, trying renderer fallback...`
              )
              const bpm = await calculateBpm(trackToScan.filepath)
              await window.api.updateTrackBpm(trackId, playlistId, bpm)
              onUpdateBpm(trackId, bpm)
            }
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error(`Failed to calculate BPM for track ${trackToScan.title}:`, err)
            window.api.logError(`Failed to calculate BPM for ${trackToScan.title}: ${errMsg}`)
          } finally {
            setScanningBpm((prev) => ({ ...prev, [trackId]: false }))
          }
        }
      } finally {
        isScanningRef.current = false
      }
    }

    if (tracks.length > 0) {
      scanMissingBpm()
    }
  }, [tracks, playlistId, onUpdateBpm])

  // Auto-scan tracks with missing key
  useEffect((): void => {
    if (isScanningKeyRef.current) return

    const scanMissingKey = async (): Promise<void> => {
      isScanningKeyRef.current = true
      try {
        while (true) {
          const trackToScan = tracks.find(
            (t) => (!t.key || t.key === '') && t.filepath && !scannedKeyRef.current.has(t.id)
          )
          if (!trackToScan) break

          scannedKeyRef.current.add(trackToScan.id)
          try {
            const result = await window.api.analyzeTrackKey(
              trackToScan.id,
              playlistId,
              trackToScan.filepath
            )
            if (result.success && result.key) {
              onUpdateKey(trackToScan.id, result.key)
            }
          } catch (err: unknown) {
            console.error(`Failed to analyze key for ${trackToScan.title}:`, err)
          }
        }
      } finally {
        isScanningKeyRef.current = false
      }
    }

    if (tracks.length > 0) {
      scanMissingKey()
    }
  }, [tracks, playlistId, onUpdateKey])

  return scanningBpm
}
