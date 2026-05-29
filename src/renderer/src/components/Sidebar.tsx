import React, { useState } from 'react'
import {
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  Pencil
} from 'lucide-react'
import type { Playlist } from '@main/db'
import logo from '../assets/logo-recordfox.svg'
import logoLight from '../assets/logo-recordfox-light.svg'
import { useLanguage } from '../i18n'

interface SidebarProps {
  playlists: Playlist[]
  selectedPlaylistId: string | null
  onSelectPlaylist: (id: string) => void
  onDeletePlaylist: (id: string) => void
  onSyncPlaylist: (id: string) => void
  onRenamePlaylist: (id: string, newTitle: string) => void
  onOpenAddModal: () => void
  onOpenSettings: () => void
  activeSyncs: Record<
    string,
    {
      status: string
      total?: number
      completedTrackIds?: string[]
      activeDownloads?: Record<string, { trackId: string; title: string; percent: number }>
    }
  >
  width?: number
  theme?: 'dark' | 'light'
}

export default function Sidebar({
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
  onDeletePlaylist,
  onSyncPlaylist,
  onRenamePlaylist,
  onOpenAddModal,
  onOpenSettings,
  activeSyncs,
  width,
  theme = 'dark'
}: SidebarProps): React.JSX.Element {
  const { t } = useLanguage()
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState<string>('')

  const startEditing = (playlist: Playlist): void => {
    setEditingPlaylistId(playlist.id)
    setEditingTitle(playlist.title)
  }

  const saveRename = (id: string): void => {
    const trimmed = editingTitle.trim()
    if (trimmed && trimmed !== playlists.find((p) => p.id === id)?.title) {
      onRenamePlaylist(id, trimmed)
    }
    setEditingPlaylistId(null)
  }

  const cancelRename = (): void => {
    setEditingPlaylistId(null)
  }
  return (
    <div
      className="flex h-full flex-col border-r border-zinc-900 bg-zinc-950/80 backdrop-blur-md"
      style={{ width: width ? `${width}px` : '256px', minWidth: width ? `${width}px` : '256px' }}
    >
      <div className="flex h-16 items-center justify-between border-b border-zinc-900 px-6">
        <div className="flex items-center gap-2 font-bold text-zinc-100">
          <img
            src={theme === 'light' ? logo : logoLight}
            className="h-13 w-13 object-contain"
            alt="RecordFox"
          />
          <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            RecordFox
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {t('sidebar.playlists')}
          </span>
          <button
            onClick={onOpenAddModal}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          {playlists.map((playlist) => {
            const syncState = activeSyncs[playlist.id] || { status: playlist.syncStatus }
            const isSelected = selectedPlaylistId === playlist.id

            return (
              <div
                key={playlist.id}
                onClick={() => onSelectPlaylist(playlist.id)}
                className={`group relative flex flex-col rounded-lg px-3 py-2.5 transition cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  {editingPlaylistId === playlist.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveRename(playlist.id)
                        } else if (e.key === 'Escape') {
                          cancelRename()
                        }
                      }}
                      onBlur={() => saveRename(playlist.id)}
                      className="w-full bg-zinc-800 text-zinc-100 px-2 py-0.5 rounded border border-primary focus:outline-none text-sm font-medium"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div
                      className="truncate pr-8 font-medium text-sm"
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        startEditing(playlist)
                      }}
                    >
                      {playlist.title}
                    </div>
                  )}

                  {/* Status Indicator */}
                  {editingPlaylistId !== playlist.id && (
                    <div className="absolute right-3 top-3 flex items-center gap-1.5">
                      {syncState.status === 'syncing' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : syncState.status === 'error' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 opacity-60" />
                      )}
                    </div>
                  )}
                </div>

                {/* Last sync / progress details */}
                {syncState.status === 'syncing' ? (
                  <div className="mt-1.5 space-y-2">
                    {syncState.total && syncState.total > 0 ? (
                      <>
                        {/* Overall Progress Bar */}
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-semibold">
                          <span>Downloads</span>
                          <span>
                            {syncState.completedTrackIds?.length || 0}/{syncState.total}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.floor(
                                  (((syncState.completedTrackIds?.length || 0) +
                                    Object.values(syncState.activeDownloads || {}).reduce(
                                      (sum, dl: { percent: number }) => sum + dl.percent / 100,
                                      0
                                    )) /
                                    syncState.total) *
                                    100
                                )
                              )}%`
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-zinc-500 animate-pulse">
                        {t('sidebar.loadingDetails')}
                      </div>
                    )}

                    {/* Active Parallel Worker Downloads List */}
                    {syncState.activeDownloads &&
                      Object.keys(syncState.activeDownloads).length > 0 && (
                        <div className="mt-1 space-y-1.5 border-t border-zinc-900/60 pt-1.5">
                          {Object.values(syncState.activeDownloads).map(
                            (dl: { trackId: string; title: string; percent: number }) => (
                              <div key={dl.trackId} className="space-y-0.5">
                                <div className="flex items-center justify-between text-[9px] text-zinc-500">
                                  <span className="truncate max-w-[150px]" title={dl.title}>
                                    ⬇️ {dl.title}
                                  </span>
                                  <span className="font-mono text-zinc-400 font-bold">
                                    {dl.percent}%
                                  </span>
                                </div>
                                <div className="h-0.5 w-full rounded-full bg-zinc-900/60 overflow-hidden">
                                  <div
                                    className="h-full bg-purple-500 transition-all duration-200"
                                    style={{ width: `${dl.percent}%` }}
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                  </div>
                ) : (
                  playlist.lastSync && (
                    <div className="mt-0.5 text-[10px] text-zinc-600">
                      Sync:{' '}
                      {(() => {
                        const d = new Date(playlist.lastSync)
                        if (isNaN(d.getTime())) return ''
                        const pad = (n: number): string => String(n).padStart(2, '0')
                        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
                      })()}
                    </div>
                  )
                )}

                {/* Hover Actions */}
                {editingPlaylistId !== playlist.id && (
                  <div className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditing(playlist)
                      }}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSyncPlaylist(playlist.id)
                      }}
                      disabled={syncState.status === 'syncing'}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeletePlaylist(playlist.id)
                      }}
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {playlists.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <img
                src={theme === 'light' ? logo : logoLight}
                className="h-8 w-8 object-contain opacity-20"
                alt={t('sidebar.noPlaylists')}
              />
              <p className="mt-2 text-xs text-zinc-600">{t('sidebar.noPlaylists')}</p>
              <button
                onClick={onOpenAddModal}
                className="mt-3 text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                {t('sidebar.addNow')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions / Settings */}
      <div className="border-t border-zinc-900 p-4 bg-zinc-950/20">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          <span>{t('sidebar.settings')}</span>
        </button>
      </div>
    </div>
  )
}
