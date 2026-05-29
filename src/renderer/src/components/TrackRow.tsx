import React from 'react'
import { Loader2, Music, Star } from 'lucide-react'
import type { Track } from '@main/db'
import { formatDuration, getMediaUrl } from '../utils/audio'

// Camelot wheel color – maps the number (1–12) to a hue on the color wheel
function camelotColor(camelot: string): string {
  const num = parseInt(camelot)
  if (isNaN(num)) return '#52525b'
  const hue = ((num - 1) / 12) * 360
  return `hsl(${hue}, 65%, 52%)`
}

interface TrackRowProps {
  track: Track
  playlistId: string
  onLoadTrack: (track: Track, deck: 'A' | 'B') => void
  onUpdateRating: (trackId: string, rating: number) => void
  isPlayingA: boolean
  isPlayingB: boolean
  activeDownload: { trackId: string; title: string; percent: number } | undefined
  isScanningBpm: boolean
}

export default function TrackRow({
  track,
  playlistId,
  onLoadTrack,
  onUpdateRating,
  isPlayingA,
  isPlayingB,
  activeDownload,
  isScanningBpm
}: TrackRowProps): React.JSX.Element {
  const coverUrl = track.coverPath ? getMediaUrl(track.coverPath) : ''
  const sizeInMB = track.filesize ? `${(track.filesize / (1024 * 1024)).toFixed(1)} MB` : '---'
  const isPlaceholder = !track.filepath

  const handleDragStart = (e: React.DragEvent): void => {
    e.dataTransfer.setData('text/plain', JSON.stringify(track))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleSetRating = async (ratingVal: number): Promise<void> => {
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
      draggable={!isPlaceholder}
      onDragStart={!isPlaceholder ? handleDragStart : undefined}
      className={`hover:bg-zinc-900/30 group transition-colors ${
        isPlaceholder
          ? 'opacity-60 cursor-not-allowed select-none'
          : 'cursor-grab active:cursor-grabbing'
      } ${isPlayingA || isPlayingB ? 'bg-primary/5' : ''}`}
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
        <div className="font-semibold text-zinc-200 truncate max-w-[280px]">{track.title}</div>
        <div className="text-xs text-zinc-500 truncate max-w-[280px]">{track.artist}</div>
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
                onClick={(): Promise<void> => handleSetRating(starValue)}
                disabled={isPlaceholder}
                className={`transition-colors p-0.5 ${
                  isPlaceholder
                    ? 'text-zinc-800 cursor-not-allowed'
                    : 'text-zinc-600 hover:text-amber-500'
                }`}
              >
                <Star
                  className={`h-3.5 w-3.5 ${
                    isFilled
                      ? 'fill-amber-500 text-amber-500'
                      : isPlaceholder
                        ? 'text-zinc-800'
                        : 'text-zinc-700 hover:text-amber-500'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </td>

      <td className="py-2.5 text-center font-mono font-medium text-zinc-400">
        {isScanningBpm ? (
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
            type="button"
            onClick={(): void => {
              if (!isPlaceholder) onLoadTrack(track, 'A')
            }}
            disabled={isPlaceholder}
            className={`rounded px-2.5 py-1 text-xs font-bold transition ${
              isPlayingA
                ? 'bg-primary text-white'
                : isPlaceholder
                  ? 'bg-zinc-950/40 text-zinc-700 cursor-not-allowed border border-zinc-900/60'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-primary/20 hover:text-primary'
            }`}
          >
            Deck A
          </button>
          <button
            type="button"
            onClick={(): void => {
              if (!isPlaceholder) onLoadTrack(track, 'B')
            }}
            disabled={isPlaceholder}
            className={`rounded px-2.5 py-1 text-xs font-bold transition ${
              isPlayingB
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
}
