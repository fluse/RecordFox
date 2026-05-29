import React, { useState, useMemo } from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import type { Track } from '@main/db'
import { useTrackScanner } from '../hooks/useTrackScanner'
import TrackRow from './TrackRow'

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

  // Hook for background scanning of missing BPMs/Keys
  const scanningBpm = useTrackScanner(tracks, playlistId, onUpdateBpm, onUpdateKey)

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const filteredAndSortedTracks = useMemo((): Track[] => {
    let result = [...tracks]

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
      )
    }

    // Sorting
    result.sort((a, b) => {
      const valA = a[sortField]
      const valB = b[sortField]

      if (valA === undefined && valB === undefined) return 0
      if (valA === undefined) return sortOrder === 'asc' ? 1 : -1
      if (valB === undefined) return sortOrder === 'asc' ? -1 : 1

      if (typeof valA === 'string' && typeof valB === 'string') {
        const strA = valA.toLowerCase()
        const strB = valB.toLowerCase()
        if (strA < strB) return sortOrder === 'asc' ? -1 : 1
        if (strA > strB) return sortOrder === 'asc' ? 1 : -1
        return 0
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1
        return 0
      }

      return 0
    })

    return result
  }, [tracks, search, sortField, sortOrder])

  return (
    <div className="flex flex-1 flex-col bg-zinc-900/40">
      {/* Header / Search */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-900 px-6">
        <h1 className="text-lg font-bold text-zinc-200 truncate max-w-[300px]">{playlistTitle}</h1>
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
              <th
                className="py-3 cursor-pointer hover:text-zinc-300"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-1.5">
                  Titel / Interpret
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th
                className="py-3 cursor-pointer hover:text-zinc-300 w-32 text-center"
                onClick={() => handleSort('rating')}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Rating
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th
                className="py-3 cursor-pointer hover:text-zinc-300 w-24 text-center"
                onClick={() => handleSort('bpm')}
              >
                <div className="flex items-center justify-center gap-1.5">
                  BPM
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th
                className="py-3 cursor-pointer hover:text-zinc-300 w-24 text-center"
                onClick={() => handleSort('key')}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Key
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th
                className="py-3 cursor-pointer hover:text-zinc-300 w-36 text-center"
                onClick={() => handleSort('bitrate')}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Format / Qualität
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th
                className="py-3 cursor-pointer hover:text-zinc-300 w-24 text-right"
                onClick={() => handleSort('duration')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Dauer
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </th>
              <th className="py-3 w-40 text-center">In Deck laden</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-zinc-900/50">
            {filteredAndSortedTracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                playlistId={playlistId}
                onLoadTrack={onLoadTrack}
                onUpdateRating={onUpdateRating}
                isPlayingA={currentTrackA?.id === track.id}
                isPlayingB={currentTrackB?.id === track.id}
                activeDownload={activeDownloads?.[track.id]}
                isScanningBpm={!!scanningBpm[track.id]}
              />
            ))}
            {filteredAndSortedTracks.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-600 text-sm">
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
