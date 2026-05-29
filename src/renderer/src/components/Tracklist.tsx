import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, ArrowUpDown, Loader2, Music, Star } from 'lucide-react'
import type { Track } from '@main/db'
import { calculateBpm, formatDuration, getMediaUrl } from '../utils/audio'

// Camelot wheel color – maps the number (1–12) to a hue on the color wheel
function camelotColor(camelot: string): string {
  const num = parseInt(camelot)
  if (isNaN(num)) return '#52525b'
  const hue = ((num - 1) / 12) * 360
  return `hsl(${hue}, 65%, 52%)`
}

interface TracklistProps {
  playlistId: string
  playlistTitle: string
  tracks: Track[]
  onLoadTrack: (track: Track, deck: 'A' | 'B') => void
  onUpdateBpm: (trackId: string, bpm: number) => void
  onUpdateKey: (trackId: string, key: string) => void
  onUpdateRating: (trackId: string, rating: number) => void
  currentTrackA: Track | null
  currentTrackB: Track | null
  activeDownloads?: Record<string, { trackId: string; title: string; percent: number }>
}

type SortField = 'title' | 'artist' | 'bpm' | 'key' | 'duration' | 'filesize' | 'rating' | 'bitrate'
type SortOrder = 'asc' | 'desc'

export default function Tracklist({
  playlistId,
  playlistTitle,
  tracks,
  onLoadTrack,
  onUpdateBpm,
  onUpdateKey,
  onUpdateRating,
  currentTrackA,
  currentTrackB,
  activeDownloads
}: TracklistProps): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('title')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [scanningBpm, setScanningBpm] = useState<Record<string, boolean>>({})

  const scannedRef = useRef<Set<string>>(new Set())
  const isScanningRef = useRef(false)
  const scannedKeyRef = useRef<Set<string>>(new Set())
  const isScanningKeyRef = useRef(false)

  // Clear scanned list when selected playlist changes so tracks can be retried
  useEffect(() => {
    scannedRef.current.clear()
    isScanningRef.current = false
    scannedKeyRef.current.clear()
    isScanningKeyRef.current = false
  }, [playlistId])

  // Auto-scan tracks with BPM = 0 when the playlist is displayed.
  // Primary: delegates to main process (FFmpeg + autocorrelation).
  // Fallback: in-renderer music-tempo analysis.
  useEffect(() => {
    if (isScanningRef.current) return

    const scanMissingBpm = async () => {
      isScanningRef.current = true
      try {
        while (true) {
          const trackToScan = tracks.find(
            t => t.bpm === 0 && t.filepath && !scannedRef.current.has(t.id)
          )
          if (!trackToScan) break

          const trackId = trackToScan.id
          scannedRef.current.add(trackId)
          setScanningBpm(prev => ({ ...prev, [trackId]: true }))

          try {
            // Primary: use main-process BPM analyzer (FFmpeg-based)
            const result = await window.api.analyzeTrackBpm(trackId, playlistId, trackToScan.filepath)
            if (result.success && result.bpm && result.bpm > 0) {
              onUpdateBpm(trackId, result.bpm)
            } else {
              // Fallback: in-renderer music-tempo
              console.log(`[BPM] Main process returned no BPM for ${trackToScan.title}, trying renderer fallback...`)
              const bpm = await calculateBpm(trackToScan.filepath)
              await window.api.updateTrackBpm(trackId, playlistId, bpm)
              onUpdateBpm(trackId, bpm)
            }
          } catch (e: any) {
            console.error(`Failed to calculate BPM for track ${trackToScan.title}:`, e)
            window.api.logError(`Failed to calculate BPM for ${trackToScan.title}: ${e?.message || e}`)
          } finally {
            setScanningBpm(prev => ({ ...prev, [trackId]: false }))
          }
        }
      } finally {
        isScanningRef.current = false
      }
    }

    if (tracks.length > 0) {
      scanMissingBpm()
    }
  }, [tracks, playlistId])

  // Auto-scan tracks with missing key
  useEffect(() => {
    if (isScanningKeyRef.current) return

    const scanMissingKey = async () => {
      isScanningKeyRef.current = true
      try {
        while (true) {
          const trackToScan = tracks.find(
            t => (!t.key || t.key === '') && t.filepath && !scannedKeyRef.current.has(t.id)
          )
          if (!trackToScan) break

          scannedKeyRef.current.add(trackToScan.id)
          try {
            const result = await window.api.analyzeTrackKey(trackToScan.id, playlistId, trackToScan.filepath)
            if (result.success && result.key) {
              onUpdateKey(trackToScan.id, result.key)
            }
          } catch (e: any) {
            console.error(`Failed to analyze key for ${trackToScan.title}:`, e)
          }
        }
      } finally {
        isScanningKeyRef.current = false
      }
    }

    if (tracks.length > 0) {
      scanMissingKey()
    }
  }, [tracks, playlistId])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const filteredAndSortedTracks = useMemo(() => {
    let result = [...tracks]

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      )
    }

    // Sorting
    result.sort((a, b) => {
      let valA: any = a[sortField]
      let valB: any = b[sortField]

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = valB.toLowerCase()
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [tracks, search, sortField, sortOrder])

  return (
    <div className="flex flex-1 flex-col bg-zinc-900/40">
      {/* Header / Search */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-900 px-6">
        <h1 className="text-lg font-bold text-zinc-200 truncate max-w-[300px]">
          {playlistTitle}
        </h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Suchen nach Titel, Interpret..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-zinc-800 bg-zinc-950 py-1.5 pl-9 pr-4 text-xs text-zinc-300 outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Tracks Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/80 text-xs font-semibold text-zinc-500">
              <th className="py-3 w-16">Cover</th>
              <th className="py-3 cursor-pointer hover:text-zinc-300" onClick={() => handleSort('title')}>
                <div className="flex items-center gap-1.5">
                  Titel / Interpret
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th className="py-3 cursor-pointer hover:text-zinc-300 w-32 text-center" onClick={() => handleSort('rating')}>
                <div className="flex items-center justify-center gap-1.5">
                  Rating
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th className="py-3 cursor-pointer hover:text-zinc-300 w-24 text-center" onClick={() => handleSort('bpm')}>
                <div className="flex items-center justify-center gap-1.5">
                  BPM
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th className="py-3 cursor-pointer hover:text-zinc-300 w-24 text-center" onClick={() => handleSort('key')}>
                <div className="flex items-center justify-center gap-1.5">
                  Key
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th className="py-3 cursor-pointer hover:text-zinc-300 w-36 text-center" onClick={() => handleSort('bitrate')}>
                <div className="flex items-center justify-center gap-1.5">
                  Format / Qualität
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th className="py-3 cursor-pointer hover:text-zinc-300 w-24 text-right" onClick={() => handleSort('duration')}>
                <div className="flex items-center justify-end gap-1.5">
                  Dauer
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th className="py-3 w-40 text-center">In Deck laden</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-zinc-900/50">            {filteredAndSortedTracks.map((track) => {
            const coverUrl = track.coverPath ? getMediaUrl(track.coverPath) : ''
            const isPlayingA = currentTrackA?.id === track.id
            const isPlayingB = currentTrackB?.id === track.id
            const sizeInMB = track.filesize
              ? `${(track.filesize / (1024 * 1024)).toFixed(1)} MB`
              : '---'
            const activeDownload = activeDownloads?.[track.id]
            const isPlaceholder = !track.filepath

            const handleDragStart = (e: React.DragEvent) => {
              e.dataTransfer.setData('text/plain', JSON.stringify(track))
              e.dataTransfer.effectAllowed = 'copy'
            }

            const handleSetRating = async (ratingVal: number) => {
              if (isPlaceholder) return // Disable rating for placeholder tracks
              // If clicking active rating, reset to 0
              const targetRating = track.rating === ratingVal ? 0 : ratingVal
              try {
                await window.api.updateTrackRating(track.id, playlistId, targetRating)
                onUpdateRating(track.id, targetRating)
              } catch (err) {
                console.error('Failed to update rating:', err)
              }
            }

            return (
              <tr
                key={track.id}
                draggable={!isPlaceholder}
                onDragStart={!isPlaceholder ? handleDragStart : undefined}
                className={`hover:bg-zinc-900/30 group transition-colors ${isPlaceholder ? 'opacity-60 cursor-not-allowed select-none' : 'cursor-grab active:cursor-grabbing'
                  } ${isPlayingA || isPlayingB ? 'bg-primary/5' : ''
                  }`}
              >
                <td className="py-2.5">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt="cover"
                      className="h-10 w-10 rounded object-cover border border-zinc-800"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-800 bg-zinc-950 text-zinc-600">
                      {isPlaceholder && activeDownload ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Music className="h-4 w-4" />
                      )}
                    </div>
                  )}
                </td>
                <td className="py-2.5">
                  <div className="font-semibold text-zinc-200 truncate max-w-[280px]">
                    {track.title}
                  </div>
                  <div className="text-xs text-zinc-500 truncate max-w-[280px]">
                    {track.artist}
                  </div>
                </td>

                {/* Rating Stars */}
                <td className="py-2.5 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((starValue) => {
                      const isFilled = starValue <= (track.rating || 0)
                      return (
                        <button
                          key={starValue}
                          type="button"
                          onClick={() => handleSetRating(starValue)}
                          disabled={isPlaceholder}
                          className={`transition-colors p-0.5 ${isPlaceholder ? 'text-zinc-800 cursor-not-allowed' : 'text-zinc-600 hover:text-amber-500'
                            }`}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${isFilled ? 'fill-amber-500 text-amber-500' : isPlaceholder ? 'text-zinc-800' : 'text-zinc-700 hover:text-amber-500'
                              }`}
                          />
                        </button>
                      )
                    })}
                  </div>
                </td>

                <td className="py-2.5 text-center font-mono font-medium text-zinc-400">
                  {scanningBpm[track.id] ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-primary" />
                  ) : isPlaceholder ? (
                    <span className="text-zinc-700 text-xs italic">-</span>
                  ) : track.bpm === 0 ? (
                    <span className="text-zinc-600 text-xs italic">Warte...</span>
                  ) : (
                    <span className="text-primary font-bold">{track.bpm}</span>
                  )}
                </td>

                <td className="py-2.5 text-center font-mono font-medium">
                  {isPlaceholder ? (
                    <span className="text-zinc-700 text-xs italic">-</span>
                  ) : !track.key ? (
                    <span className="text-zinc-600 text-xs italic">Warte...</span>
                  ) : (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-bold text-zinc-950"
                      style={{ backgroundColor: camelotColor(track.key) }}
                    >
                      {track.key}
                    </span>
                  )}
                </td>

                {/* Format & Size & Bitrate */}
                <td className="py-2.5 text-center text-xs font-mono text-zinc-400">
                  {isPlaceholder ? (
                    activeDownload ? (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-primary font-semibold">
                        <span>Lade herunter ({activeDownload.percent}%)</span>
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-xs italic">In Warteschlange...</span>
                    )
                  ) : (
                    <>
                      <span className="bg-zinc-800/60 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px] text-zinc-400 font-bold mr-1">
                        {track.format || 'MP3'}
                      </span>
                      {track.bitrate ? (
                        <span className="text-primary font-bold mr-1">{track.bitrate}k</span>
                      ) : null}
                      <span className="text-zinc-500">({sizeInMB})</span>
                    </>
                  )}
                </td>

                <td className="py-2.5 text-right font-mono text-zinc-500">
                  {formatDuration(track.duration)}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => !isPlaceholder && onLoadTrack(track, 'A')}
                      disabled={isPlaceholder}
                      className={`rounded px-2.5 py-1 text-xs font-bold transition ${isPlayingA
                          ? 'bg-primary text-white'
                          : isPlaceholder
                            ? 'bg-zinc-950/40 text-zinc-700 cursor-not-allowed border border-zinc-900/60'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-primary/20 hover:text-primary'
                        }`}
                    >
                      Deck A
                    </button>
                    <button
                      onClick={() => !isPlaceholder && onLoadTrack(track, 'B')}
                      disabled={isPlaceholder}
                      className={`rounded px-2.5 py-1 text-xs font-bold transition ${isPlayingB
                          ? 'bg-purple-600 text-white'
                          : isPlaceholder
                            ? 'bg-zinc-950/40 text-zinc-700 cursor-not-allowed border border-zinc-900/60'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-purple-600/20 hover:text-purple-400'
                        }`}
                    >
                      Deck B
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}

            {filteredAndSortedTracks.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-zinc-600 text-sm">
                  Keine Tracks gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
