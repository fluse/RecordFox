import React from 'react'
import { Loader2, Music, Star } from 'lucide-react'
import type { Track } from '@main/db'
import { formatDuration, getMediaUrl } from '../utils/audio'
import { useLanguage } from '../i18n'

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
  isReorderEnabled?: boolean
  draggedTrackId?: string | null
  dragOverTrackId?: string | null
  dragOverPosition?: 'above' | 'below' | null
  setDraggedTrackId?: (id: string | null) => void
  setDragOverTrackId?: (id: string | null) => void
  setDragOverPosition?: (pos: 'above' | 'below' | null) => void
  onReorder?: (draggedId: string, targetId: string, position: 'above' | 'below') => void
  visibleColumns: string[]
}

export default function TrackRow({
  track,
  playlistId,
  onLoadTrack,
  onUpdateRating,
  isPlayingA,
  isPlayingB,
  activeDownload,
  isScanningBpm,
  isReorderEnabled = false,
  draggedTrackId = null,
  dragOverTrackId = null,
  dragOverPosition = null,
  setDraggedTrackId,
  setDragOverTrackId,
  setDragOverPosition,
  onReorder,
  visibleColumns
}: TrackRowProps): React.JSX.Element {
  const { t } = useLanguage()
  const coverUrl = track.coverPath ? getMediaUrl(track.coverPath) : ''
  const sizeInMB = track.filesize ? `${(track.filesize / (1024 * 1024)).toFixed(1)} MB` : '---'
  const isPlaceholder = !track.filepath

  const handleDragStart = (e: React.DragEvent): void => {
    e.dataTransfer.setData('text/plain', JSON.stringify(track))
    e.dataTransfer.setData('application/react-track-id', track.id)
    e.dataTransfer.effectAllowed = isReorderEnabled ? 'move' : 'copy'
    if (isReorderEnabled && setDraggedTrackId) {
      setDraggedTrackId(track.id)
    }
  }

  const handleDragEnd = (): void => {
    if (isReorderEnabled && setDraggedTrackId) {
      setDraggedTrackId(null)
    }
    if (isReorderEnabled && setDragOverTrackId) {
      setDragOverTrackId(null)
    }
    if (isReorderEnabled && setDragOverPosition) {
      setDragOverPosition(null)
    }
  }

  const handleDragOver = (e: React.DragEvent): void => {
    if (!isReorderEnabled) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    // Calculate if pointer is hovering over top half or bottom half of the target row
    const rect = e.currentTarget.getBoundingClientRect()
    const relativeY = e.clientY - rect.top
    const position = relativeY < rect.height / 2 ? 'above' : 'below'

    if (setDragOverPosition) {
      setDragOverPosition(position)
    }
  }

  const handleDragEnter = (e: React.DragEvent): void => {
    if (!isReorderEnabled) return
    e.preventDefault()
    if (setDragOverTrackId && draggedTrackId && draggedTrackId !== track.id) {
      setDragOverTrackId(track.id)
    }
  }

  const handleDragLeave = (): void => {
    if (!isReorderEnabled) return
    if (setDragOverTrackId && dragOverTrackId === track.id) {
      setDragOverTrackId(null)
    }
    if (setDragOverPosition) {
      setDragOverPosition(null)
    }
  }

  const handleDrop = (e: React.DragEvent): void => {
    if (!isReorderEnabled) return
    e.preventDefault()
    if (setDragOverTrackId) {
      setDragOverTrackId(null)
    }
    if (setDragOverPosition) {
      setDragOverPosition(null)
    }
    const droppedTrackId = e.dataTransfer.getData('application/react-track-id')
    if (droppedTrackId && droppedTrackId !== track.id && onReorder && dragOverPosition) {
      onReorder(droppedTrackId, track.id, dragOverPosition)
    }
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
      onDragEnd={isReorderEnabled && !isPlaceholder ? handleDragEnd : undefined}
      onDragOver={isReorderEnabled && !isPlaceholder ? handleDragOver : undefined}
      onDragEnter={isReorderEnabled && !isPlaceholder ? handleDragEnter : undefined}
      onDragLeave={isReorderEnabled && !isPlaceholder ? handleDragLeave : undefined}
      onDrop={isReorderEnabled && !isPlaceholder ? handleDrop : undefined}
      className={`hover:bg-zinc-900/30 group transition-all duration-150 ${
        isPlaceholder
          ? 'opacity-60 cursor-not-allowed select-none'
          : isReorderEnabled
            ? 'cursor-row-resize'
            : 'cursor-grab active:cursor-grabbing'
      } ${isPlayingA || isPlayingB ? 'bg-primary/5' : ''} ${
        isReorderEnabled && dragOverTrackId === track.id
          ? dragOverPosition === 'above'
            ? 'border-t-2 border-primary bg-primary/5'
            : 'border-b-2 border-primary bg-primary/5'
          : ''
      } ${isReorderEnabled && draggedTrackId === track.id ? 'opacity-30' : ''}`}
    >
      {visibleColumns.map((colId) => {
        switch (colId) {
          case 'position':
            return (
              <td
                key={colId}
                className="py-2.5 text-center font-mono font-medium text-zinc-500 w-12 select-none"
              >
                {track.position || '-'}
              </td>
            )
          case 'cover':
            return (
              <td key={colId} className="py-2.5">
                <div className="flex justify-center">
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
                </div>
              </td>
            )
          case 'title':
            return (
              <td key={colId} className="py-2.5 px-3">
                <div className="font-semibold text-zinc-200 truncate max-w-[280px]">
                  {track.title}
                </div>
                <div className="text-xs text-zinc-500 truncate max-w-[280px]">{track.artist}</div>
              </td>
            )
          case 'rating':
            return (
              <td key={colId} className="py-2.5 text-center px-3">
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
            )
          case 'bpm':
            return (
              <td
                key={colId}
                className="py-2.5 text-center font-mono font-medium text-zinc-400 px-3"
              >
                {isScanningBpm ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto text-primary" />
                ) : isPlaceholder ? (
                  <span className="text-zinc-700 text-xs italic">-</span>
                ) : track.bpm === 0 ? (
                  <span className="text-zinc-600 text-xs italic">{t('track.waiting')}</span>
                ) : (
                  <span className="text-primary font-bold">{track.bpm}</span>
                )}
              </td>
            )
          case 'key':
            return (
              <td key={colId} className="py-2.5 text-center font-mono font-medium px-3">
                {isPlaceholder ? (
                  <span className="text-zinc-700 text-xs italic">-</span>
                ) : !track.key ? (
                  <span className="text-zinc-600 text-xs italic">{t('track.waiting')}</span>
                ) : (
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-bold text-zinc-950"
                    style={{ backgroundColor: camelotColor(track.key) }}
                  >
                    {track.key}
                  </span>
                )}
              </td>
            )
          case 'format':
            return (
              <td key={colId} className="py-2.5 text-center text-xs font-mono text-zinc-400 px-3">
                {isPlaceholder ? (
                  activeDownload ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-primary font-semibold">
                      <span>{t('track.downloading', { percent: activeDownload.percent })}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-600 text-xs italic">{t('track.queued')}</span>
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
            )
          case 'duration':
            return (
              <td key={colId} className="py-2.5 text-right font-mono text-zinc-500 px-3">
                {formatDuration(track.duration)}
              </td>
            )
          case 'loadDeck':
            return (
              <td key={colId} className="py-2.5 px-3">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(): void => {
                      if (!isPlaceholder) onLoadTrack(track, 'A')
                    }}
                    disabled={isPlaceholder}
                    className={`rounded px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
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
                    className={`rounded px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
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
            )
          default:
            return null
        }
      })}
    </tr>
  )
}
