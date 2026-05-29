import React, { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import Tracklist from './components/Tracklist'
import DjMixer from './components/DjMixer'
import AddPlaylistModal from './components/AddPlaylistModal'
import SettingsModal from './components/SettingsModal'
import SplashScreen from './components/SplashScreen'
import { ChevronDown } from 'lucide-react'
import type { Playlist, Track, AppSettings } from '@main/db'

export default function App(): React.JSX.Element {
  const [showSplash, setShowSplash] = useState(true)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])

  // Track loaded on Deck A / Deck B
  const [loadedTrackA, setLoadedTrackA] = useState<Track | null>(null)
  const [loadedTrackB, setLoadedTrackB] = useState<Track | null>(null)

  // Modal control
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMixerCollapsed, setIsMixerCollapsed] = useState(false)

  // App settings state
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    downloadPath: '',
    sidebarWidth: 256,
    maxWorkers: 3
  })
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const sidebarWidthRef = useRef(sidebarWidth)

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  // Real-time synchronization state map
  const [activeSyncs, setActiveSyncs] = useState<
    Record<string, {
      status: string;
      total?: number;
      completedTrackIds?: string[];
      activeDownloads?: Record<string, { trackId: string; title: string; percent: number }>;
    }>
  >({})

  // 1. Fetch playlists on startup and load settings
  useEffect(() => {
    const fetchPlaylists = async () => {
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
    const loadSettings = async () => {
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
  useEffect(() => {
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
  useEffect(() => {
    if (!selectedPlaylistId) {
      setTracks([])
      return
    }

    const fetchTracks = async () => {
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
  useEffect(() => {
    // Listen for sync status changes
    const cleanupSyncStatus = window.api.onSyncStatusChanged((playlistId, status, lastSync) => {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id === playlistId) {
            return { ...p, syncStatus: status as any, lastSync: lastSync || p.lastSync }
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

    return () => {
      cleanupSyncStatus()
      cleanupDownloadProgress()
      cleanupBpmAnalyzed()
      cleanupKeyAnalyzed()
    }
  }, [selectedPlaylistId])

  // Actions
  const handleAddPlaylist = async (url: string) => {
    const res = await window.api.addPlaylist(url)
    if (res.success && res.playlist) {
      setPlaylists((prev) => [...prev, res.playlist!])
      setSelectedPlaylistId(res.playlist.id)
    } else {
      throw new Error(res.error || 'Failed to add playlist')
    }
  }

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Möchtest du diese Playlist und alle dazugehörigen lokalen MP3s wirklich löschen?')) {
      return
    }

    const res = await window.api.deletePlaylist(id)
    if (res.success) {
      setPlaylists((prev) => prev.filter((p) => p.id !== id))
      if (selectedPlaylistId === id) {
        setSelectedPlaylistId(null)
      }

      // Unload deleted tracks from DJ decks if active
      if (loadedTrackA?.playlistId === id) setLoadedTrackA(null)
      if (loadedTrackB?.playlistId === id) setLoadedTrackB(null)
    } else {
      alert(`Fehler beim Löschen: ${res.error}`)
    }
  }

  const handleSyncPlaylist = async (id: string) => {
    const res = await window.api.syncPlaylist(id)
    if (!res.success) {
      alert(`Fehler beim Synchronisieren: ${res.error}`)
    }
  }

  const handleLoadTrack = (track: Track, deck: 'A' | 'B') => {
    if (deck === 'A') {
      setLoadedTrackA(track)
    } else {
      setLoadedTrackB(track)
    }
  }

  // Called when a track's BPM is calculated in the background
  const handleUpdateBpmInState = (trackId: string, bpm: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, bpm } : t))
    )
    if (loadedTrackA?.id === trackId) {
      setLoadedTrackA(prev => prev ? { ...prev, bpm } : null)
    }
    if (loadedTrackB?.id === trackId) {
      setLoadedTrackB(prev => prev ? { ...prev, bpm } : null)
    }
  }

  // Called when a track's key is analyzed in the background
  const handleUpdateKeyInState = (trackId: string, key: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, key } : t))
    )
    if (loadedTrackA?.id === trackId) {
      setLoadedTrackA(prev => prev ? { ...prev, key } : null)
    }
    if (loadedTrackB?.id === trackId) {
      setLoadedTrackB(prev => prev ? { ...prev, key } : null)
    }
  }

  const handleUpdateRatingInState = (trackId: string, rating: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, rating } : t))
    )
    if (loadedTrackA?.id === trackId) {
      setLoadedTrackA(prev => prev ? { ...prev, rating } : null)
    }
    if (loadedTrackB?.id === trackId) {
      setLoadedTrackB(prev => prev ? { ...prev, rating } : null)
    }
  }

  const handleMouseDownSplitter = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(180, Math.min(480, startWidth + deltaX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = async () => {
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
  }

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const res = await window.api.updateSettings(newSettings)
      if (res.success) {
        setSettings((prev) => ({ ...prev, ...newSettings }))
      } else {
        alert(`Fehler beim Aktualisieren der Einstellungen: ${res.error}`)
      }
    } catch (e: any) {
      console.error(e)
      alert('Fehler beim Aktualisieren der Einstellungen.')
    }
  }

  const handleMigrate = async (newPath: string, moveFiles: boolean) => {
    try {
      const res = await window.api.migrateSettings(newPath, moveFiles)
      if (res.success) {
        setSettings((prev) => ({ ...prev, downloadPath: newPath }))
        // Refresh tracks to get the updated local filepaths
        if (selectedPlaylistId) {
          const list = await window.api.getTracks(selectedPlaylistId)
          setTracks(list)
        }
        alert('Speicherort erfolgreich geändert und Dateien ggf. verschoben!')
      } else {
        alert(`Fehler bei der Migration: ${res.error}`)
      }
    } catch (e: any) {
      console.error(e)
      alert('Fehler bei der Migration.')
    }
  }

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100 font-sans antialiased">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {/* Top Half: DJ Mixer Dashboard */}
      <div className="relative flex-shrink-0 z-20">
        <div 
          className="transition-all duration-300 ease-in-out overflow-hidden border-b border-zinc-900 bg-zinc-950/40"
          style={{ 
            maxHeight: isMixerCollapsed ? '0px' : '500px', 
            opacity: isMixerCollapsed ? 0 : 1,
            borderBottomWidth: isMixerCollapsed ? '0px' : '1px'
          }}
        >
          <DjMixer
            trackA={loadedTrackA}
            trackB={loadedTrackB}
            onUpdateBpm={handleUpdateBpmInState}
            onLoadTrack={handleLoadTrack}
          />
        </div>
        {/* Toggle Button */}
        <button
          onClick={() => setIsMixerCollapsed(!isMixerCollapsed)}
          className="absolute bottom-[-12px] left-1/2 -translate-x-1/2 z-30 flex h-6 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:border-primary/55 transition-colors shadow-lg cursor-pointer"
          title={isMixerCollapsed ? "Mixer einblenden" : "Mixer ausblenden"}
        >
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isMixerCollapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {/* Bottom Half: Sidebar and Track Browser */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          playlists={playlists}
          selectedPlaylistId={selectedPlaylistId}
          onSelectPlaylist={setSelectedPlaylistId}
          onDeletePlaylist={handleDeletePlaylist}
          onSyncPlaylist={handleSyncPlaylist}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          activeSyncs={activeSyncs}
          width={sidebarWidth}
        />

        {/* Resizer Splitter */}
        <div
          onMouseDown={handleMouseDownSplitter}
          className="w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary bg-zinc-900 transition-colors h-full select-none"
        />

        {selectedPlaylistId && selectedPlaylist ? (
          <Tracklist
            playlistId={selectedPlaylistId}
            playlistTitle={selectedPlaylist.title}
            tracks={tracks}
            onLoadTrack={handleLoadTrack}
            onUpdateBpm={handleUpdateBpmInState}
            onUpdateKey={handleUpdateKeyInState}
            onUpdateRating={handleUpdateRatingInState}
            currentTrackA={loadedTrackA}
            currentTrackB={loadedTrackB}
            activeDownloads={activeSyncs[selectedPlaylistId]?.activeDownloads}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-zinc-900/10 text-zinc-500 text-sm">
            Wähle eine Playlist aus oder füge eine neue hinzu, um Tracks anzuzeigen.
          </div>
        )}
      </div>

      {/* Modal Dialogs */}
      <AddPlaylistModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddPlaylist}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onMigrate={handleMigrate}
        isSyncing={Object.keys(activeSyncs).length > 0}
      />
    </div>
  )
}
