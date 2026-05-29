import React, { useState, useMemo } from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, HardDrive, SlidersHorizontal } from 'lucide-react'
import type { Track } from '@main/db'
import { useLanguage, type TranslationKey } from '../i18n'
import { useTrackScanner } from '../hooks/useTrackScanner'
import TrackRow from './TrackRow'
import UsbExportModal from './UsbExportModal'

interface TracklistProps {
  playlistId: string
  playlistTitle: string
  tracks: Track[]
  onLoadTrack: (track: Track, deck: 'A' | 'B') => void
  onUpdateBpm: (trackId: string, bpm: number) => void
  onUpdateKey: (trackId: string, key: string) => void
  onUpdateRating: (trackId: string, rating: number) => void
  onReorderTracks: (playlistId: string, trackIds: string[]) => Promise<void>
  currentTrackA: Track | null
  currentTrackB: Track | null
  activeDownloads?: Record<string, { trackId: string; title: string; percent: number }>
}

type SortField =
  | 'position'
  | 'title'
  | 'artist'
  | 'bpm'
  | 'key'
  | 'duration'
  | 'filesize'
  | 'rating'
  | 'bitrate'
type SortOrder = 'asc' | 'desc'

interface ColumnConfig {
  id: string
  labelKey: TranslationKey
  sortField?: SortField
  align?: 'left' | 'center' | 'right'
  canHide?: boolean
  defaultWidth: number
}

const COLUMN_DEFS: ColumnConfig[] = [
  {
    id: 'position',
    labelKey: 'tracklist.colPosition',
    sortField: 'position',
    align: 'center',
    canHide: true,
    defaultWidth: 48
  },
  { id: 'cover', labelKey: 'tracklist.colCover', align: 'center', canHide: true, defaultWidth: 64 },
  {
    id: 'title',
    labelKey: 'tracklist.colTitle',
    sortField: 'title',
    align: 'left',
    canHide: false,
    defaultWidth: 280
  },
  {
    id: 'rating',
    labelKey: 'tracklist.colRating',
    sortField: 'rating',
    align: 'center',
    canHide: true,
    defaultWidth: 120
  },
  {
    id: 'bpm',
    labelKey: 'tracklist.colBpm',
    sortField: 'bpm',
    align: 'center',
    canHide: true,
    defaultWidth: 90
  },
  {
    id: 'key',
    labelKey: 'tracklist.colKey',
    sortField: 'key',
    align: 'center',
    canHide: true,
    defaultWidth: 90
  },
  {
    id: 'format',
    labelKey: 'tracklist.colFormat',
    sortField: 'bitrate',
    align: 'center',
    canHide: true,
    defaultWidth: 140
  },
  {
    id: 'duration',
    labelKey: 'tracklist.colDuration',
    sortField: 'duration',
    align: 'right',
    canHide: true,
    defaultWidth: 90
  },
  {
    id: 'loadDeck',
    labelKey: 'tracklist.colLoadDeck',
    align: 'center',
    canHide: true,
    defaultWidth: 160
  }
]

const DEFAULT_COLUMN_WIDTHS = COLUMN_DEFS.reduce<Record<string, number>>((acc, col) => {
  acc[col.id] = col.defaultWidth
  return acc
}, {})

const DEFAULT_VISIBLE_COLUMNS = COLUMN_DEFS.map((col) => col.id)

export default function Tracklist({
  playlistId,
  playlistTitle,
  tracks,
  onLoadTrack,
  onUpdateBpm,
  onUpdateKey,
  onUpdateRating,
  onReorderTracks,
  currentTrackA,
  currentTrackB,
  activeDownloads
}: TracklistProps): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('position')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null)
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null)
  const { t } = useLanguage()

  const [isColMenuOpen, setIsColMenuOpen] = useState(false)

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('recordfox_visible_columns')
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
  })

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('recordfox_column_widths')
    return saved ? JSON.parse(saved) : DEFAULT_COLUMN_WIDTHS
  })

  const toggleColumn = (colId: string): void => {
    setVisibleColumns((prev) => {
      let next: string[]
      if (prev.includes(colId)) {
        next = prev.filter((id) => id !== colId)
      } else {
        next = COLUMN_DEFS.filter((c) => c.id === colId || prev.includes(c.id)).map((c) => c.id)
      }
      localStorage.setItem('recordfox_visible_columns', JSON.stringify(next))
      return next
    })
  }

  const handleResizeStart = (colId: string, e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = columnWidths[colId] || DEFAULT_COLUMN_WIDTHS[colId]

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const dx = moveEvent.clientX - startX
      const newWidth = Math.max(30, startWidth + dx)
      setColumnWidths((prev) => {
        const next = { ...prev, [colId]: newWidth }
        return next
      })
    }

    const handleMouseUp = (): void => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      setColumnWidths((prev) => {
        localStorage.setItem('recordfox_column_widths', JSON.stringify(prev))
        return prev
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const isReorderEnabled = !search.trim() && sortField === 'position'

  const handleReorder = (
    draggedId: string,
    targetId: string,
    position: 'above' | 'below'
  ): void => {
    const dragIndex = tracks.findIndex((t) => t.id === draggedId)
    if (dragIndex === -1) return

    const newTracks = [...tracks]
    const [draggedTrack] = newTracks.splice(dragIndex, 1)

    const shiftedTargetIndex = newTracks.findIndex((t) => t.id === targetId)
    if (shiftedTargetIndex === -1) return

    const insertIndex = position === 'above' ? shiftedTargetIndex : shiftedTargetIndex + 1
    newTracks.splice(insertIndex, 0, draggedTrack)

    onReorderTracks(
      playlistId,
      newTracks.map((t) => t.id)
    )
  }

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

  const visibleCols = useMemo(() => {
    return COLUMN_DEFS.filter((c) => visibleColumns.includes(c.id))
  }, [visibleColumns])

  return (
    <div className="flex flex-1 flex-col bg-zinc-900/40">
      {/* Header / Search */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-900 px-6">
        <h1 className="text-lg font-bold text-zinc-200 truncate max-w-[300px]">{playlistTitle}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={(): void => setIsExportModalOpen(true)}
            className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100 hover:border-primary/55 cursor-pointer"
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>{t('tracklist.usbExport')}</span>
          </button>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder={t('tracklist.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-zinc-800 bg-zinc-950 py-1.5 pl-9 pr-4 text-xs text-zinc-300 outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Column Customizer Button */}
          <div className="relative">
            <button
              onClick={(): void => setIsColMenuOpen(!isColMenuOpen)}
              className={`flex items-center justify-center h-8 w-8 rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 hover:border-primary/55 cursor-pointer ${isColMenuOpen ? 'border-primary/50 text-primary bg-zinc-900' : ''
                }`}
              title={t('tracklist.customizeColumns')}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            {isColMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={(): void => setIsColMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-xl backdrop-blur-md z-40 animate-in fade-in slide-in-from-top-1 duration-100">
                  <h3 className="mb-2 px-2 text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    {t('tracklist.customizeColumns')}
                  </h3>
                  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                    {COLUMN_DEFS.map((col) => {
                      const isVisible = visibleColumns.includes(col.id)
                      const isLocked = !col.canHide
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium transition select-none ${isLocked
                              ? 'text-zinc-600 cursor-not-allowed opacity-60'
                              : 'text-zinc-300 hover:bg-zinc-900/60 hover:text-zinc-100 cursor-pointer'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            disabled={isLocked}
                            onChange={(): void => toggleColumn(col.id)}
                            className="rounded border-zinc-800 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                          />
                          <span>{t(col.labelKey)}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tracks Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <table
          className="w-full text-left border-collapse min-w-full"
          style={{ tableLayout: 'fixed' }}
        >
          <colgroup>
            {visibleCols.map((col) => (
              <col
                key={col.id}
                style={{ width: `${columnWidths[col.id] ?? DEFAULT_COLUMN_WIDTHS[col.id]}px` }}
              />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-800/80 text-xs font-semibold text-zinc-500">
              {visibleCols.map((col, idx) => {
                const isSortable = !!col.sortField
                const isSorted = isSortable && sortField === col.sortField
                const isLast = idx === visibleCols.length - 1
                const alignmentClass =
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'

                return (
                  <th
                    key={col.id}
                    className={`py-3 px-3 relative select-none ${alignmentClass} ${isSortable ? 'cursor-pointer hover:text-zinc-300' : ''
                      } ${isSorted ? 'text-primary font-bold' : ''}`}
                    onClick={
                      isSortable && col.sortField ? () => handleSort(col.sortField!) : undefined
                    }
                  >
                    <div
                      className={`flex items-center gap-1.5 ${col.align === 'center'
                          ? 'justify-center'
                          : col.align === 'right'
                            ? 'justify-end'
                            : 'justify-start'
                        }`}
                    >
                      <span>{t(col.labelKey)}</span>
                      {isSortable &&
                        (isSorted ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
                        ))}
                    </div>

                    {/* Column Resize Handle */}
                    {!isLast && (
                      <div
                        className="absolute top-0 right-0 translate-x-1/2 h-full w-3 cursor-col-resize flex items-center justify-center z-10 group"
                        onMouseDown={(e) => handleResizeStart(col.id, e)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="h-4 w-[1px] bg-zinc-700/60 group-hover:bg-primary/70 group-active:bg-primary transition-colors" />
                      </div>
                    )}
                  </th>
                )
              })}
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
                isReorderEnabled={isReorderEnabled}
                draggedTrackId={draggedTrackId}
                dragOverTrackId={dragOverTrackId}
                dragOverPosition={dragOverPosition}
                setDraggedTrackId={setDraggedTrackId}
                setDragOverTrackId={setDragOverTrackId}
                setDragOverPosition={setDragOverPosition}
                onReorder={handleReorder}
                visibleColumns={visibleColumns}
              />
            ))}
            {filteredAndSortedTracks.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="py-8 text-center text-zinc-600 text-sm"
                >
                  {t('tracklist.noTracksFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <UsbExportModal
        isOpen={isExportModalOpen}
        onClose={(): void => setIsExportModalOpen(false)}
        playlistId={playlistId}
        playlistTitle={playlistTitle}
      />
    </div>
  )
}
