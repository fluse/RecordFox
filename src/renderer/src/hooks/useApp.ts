import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { Playlist, Track, AppSettings } from '@main/db'
import { de } from '../i18n/locales/de'
import { en } from '../i18n/locales/en'
import { fr } from '../i18n/locales/fr'
import { es } from '../i18n/locales/es'
import type { TranslationKey } from '../i18n'

const translations = { de, en, fr, es }

export interface ActiveSync {
  status: string
  total?: number
  completedTrackIds?: string[]
  activeDownloads?: Record<string, { trackId: string; title: string; percent: number }>
}

export type ActiveSyncsMap = Record<string, ActiveSync>

export interface UseAppReturn {
  playlists: Playlist[]
  selectedPlaylistId: string | null
  setSelectedPlaylistId: (id: string | null) => void
  tracks: Track[]
  loadedTrackA: Track | null
  loadedTrackB: Track | null
  settings: AppSettings
  sidebarWidth: number
  activeSyncs: ActiveSyncsMap
  handleAddPlaylist: (url: string) => Promise<void>
  handleDeletePlaylist: (id: string) => Promise<void>
  handleSyncPlaylist: (id: string) => Promise<void>
  handleRenamePlaylist: (id: string, newTitle: string) => Promise<void>
  handleLoadTrack: (track: Track, deck: 'A' | 'B') => void
  handleUpdateBpmInState: (trackId: string, bpm: number) => void
  handleUpdateKeyInState: (trackId: string, key: string) => void
  handleUpdateRatingInState: (trackId: string, rating: number) => void
  handleReorderTracks: (playlistId: string, trackIds: string[]) => Promise<void>
  handleUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>
  handleMigrate: (newPath: string, moveFiles: boolean) => Promise<void>
  handleMouseDownSplitter: (e: React.MouseEvent) => void
}

export function useApp(): UseAppReturn {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])

  // Track loaded on Deck A / Deck B
  const [loadedTrackA, setLoadedTrackA] = useState<Track | null>(null)
  const [loadedTrackB, setLoadedTrackB] = useState<Track | null>(null)

  // App settings state
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    downloadPath: '',
    sidebarWidth: 256,
    maxWorkers: 3,
    language: 'de'
  })
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const sidebarWidthRef = useRef<number>(sidebarWidth)

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const lang = settings.language || 'de'
      const langDict = translations[lang] || de
      let text = langDict[key] || de[key] || String(key)

      if (params) {
        Object.entries(params).forEach(([paramKey, value]) => {
          text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value))
        })
      }
      return text
    },
    [settings.language]
  )

  useEffect((): void => {
    sidebarWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  // Real-time synchronization state map
  const [activeSyncs, setActiveSyncs] = useState<ActiveSyncsMap>({})

  // Called when a track's BPM is calculated in the background
  const handleUpdateBpmInState = useCallback((trackId: string, bpm: number): void => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, bpm } : t)))
    setLoadedTrackA((prev) => (prev && prev.id === trackId ? { ...prev, bpm } : prev))
    setLoadedTrackB((prev) => (prev && prev.id === trackId ? { ...prev, bpm } : prev))
  }, [])

  // Called when a track's key is analyzed in the background
  const handleUpdateKeyInState = useCallback((trackId: string, key: string): void => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, key } : t)))
    setLoadedTrackA((prev) => (prev && prev.id === trackId ? { ...prev, key } : prev))
    setLoadedTrackB((prev) => (prev && prev.id === trackId ? { ...prev, key } : prev))
  }, [])

  const handleUpdateRatingInState = useCallback((trackId: string, rating: number): void => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, rating } : t)))
    setLoadedTrackA((prev) => (prev && prev.id === trackId ? { ...prev, rating } : prev))
    setLoadedTrackB((prev) => (prev && prev.id === trackId ? { ...prev, rating } : prev))
  }, [])

  const handleReorderTracks = useCallback(
    async (playlistId: string, trackIds: string[]): Promise<void> => {
      // Optimistic update
      setTracks((prev) => {
        const trackMap = new Map(prev.map((t) => [t.id, t]))
        return trackIds
          .map((id, index) => {
            const track = trackMap.get(id)
            if (track) {
              return { ...track, position: index + 1 }
            }
            return null
          })
          .filter(Boolean) as Track[]
      })

      try {
        const res = await window.api.reorderTracks(playlistId, trackIds)
        if (!res.success) {
          alert(t('actions.errorReorderTracks', { error: res.error || '' }))
          // Re-fetch to revert to actual db state
          const list = await window.api.getTracks(playlistId)
          setTracks(list)
        }
      } catch (err) {
        console.error('Failed to reorder tracks:', err)
        alert(t('actions.errorReorderTracks', { error: String(err) }))
        const list = await window.api.getTracks(playlistId)
        setTracks(list)
      }
    },
    [t]
  )

  const handleLoadTrack = useCallback((track: Track, deck: 'A' | 'B'): void => {
    if (deck === 'A') {
      setLoadedTrackA(track)
    } else {
      setLoadedTrackB(track)
    }
  }, [])

  const handleAddPlaylist = useCallback(async (url: string): Promise<void> => {
    const res = await window.api.addPlaylist(url)
    if (res.success && res.playlist) {
      setPlaylists((prev) => [...prev, res.playlist!])
      setSelectedPlaylistId(res.playlist.id)
    } else {
      throw new Error(res.error || 'Failed to add playlist')
    }
  }, [])

  const handleDeletePlaylist = useCallback(
    async (id: string): Promise<void> => {
      if (!confirm(t('actions.confirmDeletePlaylist'))) {
        return
      }

      const res = await window.api.deletePlaylist(id)
      if (res.success) {
        setPlaylists((prev) => prev.filter((p) => p.id !== id))
        setSelectedPlaylistId((prevSelected) => (prevSelected === id ? null : prevSelected))

        // Unload deleted tracks from DJ decks if active
        setLoadedTrackA((prev) => (prev?.playlistId === id ? null : prev))
        setLoadedTrackB((prev) => (prev?.playlistId === id ? null : prev))
      } else {
        alert(t('actions.errorDeletePlaylist', { error: res.error || '' }))
      }
    },
    [t]
  )

  const handleSyncPlaylist = useCallback(
    async (id: string): Promise<void> => {
      const res = await window.api.syncPlaylist(id)
      if (!res.success) {
        alert(t('actions.errorSyncPlaylist', { error: res.error || '' }))
      }
    },
    [t]
  )

  const handleRenamePlaylist = useCallback(
    async (id: string, newTitle: string): Promise<void> => {
      const res = await window.api.renamePlaylist(id, newTitle)
      if (res.success) {
        setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, title: newTitle } : p)))
      } else {
        alert(t('actions.errorRenamePlaylist', { error: res.error || '' }))
      }
    },
    [t]
  )

  const handleUpdateSettings = useCallback(
    async (newSettings: Partial<AppSettings>): Promise<void> => {
      try {
        const res = await window.api.updateSettings(newSettings)
        if (res.success) {
          setSettings((prev) => ({ ...prev, ...newSettings }))
        } else {
          alert(t('actions.errorUpdateSettings', { error: res.error || '' }))
        }
      } catch (err) {
        console.error(err)
        alert(t('actions.errorUpdateSettingsGeneral'))
      }
    },
    [t]
  )

  const handleMigrate = useCallback(
    async (newPath: string, moveFiles: boolean): Promise<void> => {
      try {
        const res = await window.api.migrateSettings(newPath, moveFiles)
        if (res.success) {
          setSettings((prev) => ({ ...prev, downloadPath: newPath }))
          // Refresh tracks to get the updated local filepaths
          setSelectedPlaylistId((currentPlaylistId) => {
            if (currentPlaylistId) {
              window.api.getTracks(currentPlaylistId).then(setTracks).catch(console.error)
            }
            return currentPlaylistId
          })
          alert(t('actions.successMigrate'))
        } else {
          alert(t('actions.errorMigrate', { error: res.error || '' }))
        }
      } catch (err) {
        console.error(err)
        alert(t('actions.errorMigrateGeneral'))
      }
    },
    [t]
  )

  const handleMouseDownSplitter = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidthRef.current

    const handleMouseMove = (moveEvent: MouseEvent): void => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(180, Math.min(480, startWidth + deltaX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = async (): Promise<void> => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      try {
        await window.api.updateSettings({ sidebarWidth: sidebarWidthRef.current })
      } catch (err) {
        console.error('Failed to save sidebar width settings:', err)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  // 1. Fetch playlists on startup and load settings
  useEffect((): void => {
    const fetchPlaylists = async (): Promise<void> => {
      try {
        const list = await window.api.getPlaylists()
        setPlaylists(list)
        if (list.length > 0) {
          setSelectedPlaylistId(list[0].id)
        }
      } catch (e) {
        console.error('Failed to load playlists:', e)
      }
    }
    const loadSettings = async (): Promise<void> => {
      try {
        const currentSettings = await window.api.getSettings()
        setSettings(currentSettings)
        if (currentSettings.sidebarWidth) {
          setSidebarWidth(currentSettings.sidebarWidth)
        }
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    }
    fetchPlaylists()
    loadSettings()
  }, [])

  // 2. Inject theme class into HTML document root
  useEffect((): void => {
    const root = document.documentElement
    if (settings.theme === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
    } else {
      root.classList.remove('light')
      root.classList.add('dark')
    }
  }, [settings.theme])

  // 3. Fetch tracks when selected playlist changes
  useEffect((): void => {
    if (!selectedPlaylistId) {
      Promise.resolve().then(() => {
        setTracks((prev) => (prev.length > 0 ? [] : prev))
      })
      return
    }

    const fetchTracks = async (): Promise<void> => {
      try {
        const list = await window.api.getTracks(selectedPlaylistId)
        setTracks(list)
      } catch (e) {
        console.error(`Failed to load tracks for playlist ${selectedPlaylistId}:`, e)
      }
    }

    fetchTracks()
  }, [selectedPlaylistId])

  // 4. Register IPC event listeners
  useEffect((): (() => void) => {
    // Listen for sync status changes
    const cleanupSyncStatus = window.api.onSyncStatusChanged((playlistId, status, lastSync) => {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id === playlistId) {
            return {
              ...p,
              syncStatus: status as Playlist['syncStatus'],
              lastSync: lastSync || p.lastSync
            }
          }
          return p
        })
      )

      setActiveSyncs((prev) => {
        const next = { ...prev }
        if (status === 'idle' || status === 'error') {
          delete next[playlistId] // Clean up sync progress
        } else {
          next[playlistId] = {
            ...next[playlistId],
            status,
            total: next[playlistId]?.total || 0,
            completedTrackIds: next[playlistId]?.completedTrackIds || [],
            activeDownloads: next[playlistId]?.activeDownloads || {}
          }
        }
        return next
      })

      // Refresh track list if the active playlist status changes (starts syncing or finishes)
      if (playlistId === selectedPlaylistId) {
        window.api.getTracks(playlistId).then(setTracks).catch(console.error)
      }
    })

    // Listen for download progress updates
    const cleanupDownloadProgress = window.api.onDownloadProgress((data) => {
      setActiveSyncs((prev) => {
        const playlistState = prev[data.playlistId] || {
          status: 'syncing',
          activeDownloads: {},
          completedTrackIds: []
        }
        const activeDownloads = { ...(playlistState.activeDownloads || {}) }
        const completedTrackIds = [...(playlistState.completedTrackIds || [])]

        if (data.percent >= 100) {
          delete activeDownloads[data.trackId]
          if (!completedTrackIds.includes(data.trackId)) {
            completedTrackIds.push(data.trackId)
          }
        } else {
          activeDownloads[data.trackId] = {
            trackId: data.trackId,
            title: data.title,
            percent: data.percent
          }
        }

        return {
          ...prev,
          [data.playlistId]: {
            status: 'syncing',
            total: data.total,
            completedTrackIds,
            activeDownloads
          }
        }
      })

      // Reload tracklist if a track finishes downloading
      if (data.percent >= 100 && data.playlistId === selectedPlaylistId) {
        window.api.getTracks(data.playlistId).then(setTracks).catch(console.error)
      }
    })

    // Listen for BPM analysis results from the main process
    const cleanupBpmAnalyzed = window.api.onBpmAnalyzed((trackId, _playlistId, bpm) => {
      handleUpdateBpmInState(trackId, bpm)
    })

    // Listen for Key analysis results from the main process
    const cleanupKeyAnalyzed = window.api.onKeyAnalyzed((trackId, _playlistId, key) => {
      handleUpdateKeyInState(trackId, key)
    })

    return (): void => {
      cleanupSyncStatus()
      cleanupDownloadProgress()
      cleanupBpmAnalyzed()
      cleanupKeyAnalyzed()
    }
  }, [selectedPlaylistId, handleUpdateBpmInState, handleUpdateKeyInState])

  return {
    playlists,
    selectedPlaylistId,
    setSelectedPlaylistId,
    tracks,
    loadedTrackA,
    loadedTrackB,
    settings,
    sidebarWidth,
    activeSyncs,
    handleAddPlaylist,
    handleDeletePlaylist,
    handleSyncPlaylist,
    handleRenamePlaylist,
    handleLoadTrack,
    handleUpdateBpmInState,
    handleUpdateKeyInState,
    handleUpdateRatingInState,
    handleReorderTracks,
    handleUpdateSettings,
    handleMigrate,
    handleMouseDownSplitter
  }
}
