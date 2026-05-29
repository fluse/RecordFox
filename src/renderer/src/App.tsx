import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import Tracklist from './components/Tracklist'
import DjMixer from './components/DjMixer'
import AddPlaylistModal from './components/AddPlaylistModal'
import SettingsModal from './components/SettingsModal'
import SplashScreen from './components/SplashScreen'
import { ChevronDown } from 'lucide-react'
import { useApp } from './hooks/useApp'

export default function App(): React.JSX.Element {
  const [showSplash, setShowSplash] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMixerCollapsed, setIsMixerCollapsed] = useState(false)

  const {
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
    handleLoadTrack,
    handleUpdateBpmInState,
    handleUpdateKeyInState,
    handleUpdateRatingInState,
    handleUpdateSettings,
    handleMigrate,
    handleMouseDownSplitter
  } = useApp()

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
          title={isMixerCollapsed ? 'Mixer einblenden' : 'Mixer ausblenden'}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${isMixerCollapsed ? '' : 'rotate-180'}`}
          />
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
