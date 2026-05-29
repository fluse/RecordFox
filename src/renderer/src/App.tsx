import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import Tracklist from './components/Tracklist'
import DjMixer from './components/DjMixer'
import AddPlaylistModal from './components/AddPlaylistModal'
import SettingsModal from './components/SettingsModal'
import SplashScreen from './components/SplashScreen'
import { ChevronDown } from 'lucide-react'
import { useApp } from './hooks/useApp'

import { LanguageProvider, useLanguage } from './i18n'
import type { UseAppReturn } from './hooks/useApp'

function AppContent({ appState }: { appState: UseAppReturn }): React.JSX.Element {
  const { t } = useLanguage()
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
    handleRenamePlaylist,
    handleLoadTrack,
    handleUpdateBpmInState,
    handleUpdateKeyInState,
    handleUpdateRatingInState,
    handleReorderTracks,
    handleUpdateSettings,
    handleMigrate,
    handleMouseDownSplitter
  } = appState

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100 font-sans antialiased">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {/* Top Half: DJ Mixer Dashboard */}
      <div className="relative flex-shrink-0 z-20">
        <div
          className={`mixer-container border-b border-zinc-900 bg-zinc-950/40 ${
            isMixerCollapsed ? 'collapsed' : ''
          }`}
        >
          <div className="min-h-0">
            <DjMixer
              trackA={loadedTrackA}
              trackB={loadedTrackB}
              onUpdateBpm={handleUpdateBpmInState}
              onLoadTrack={handleLoadTrack}
            />
          </div>
        </div>
        {/* Toggle Button */}
        <button
          onClick={() => setIsMixerCollapsed(!isMixerCollapsed)}
          className={`absolute left-1/2 -translate-x-1/2 z-30 flex h-6 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:border-primary/55 shadow-lg cursor-pointer transition-all duration-300 ${
            isMixerCollapsed ? 'bottom-[-24px]' : 'bottom-[-12px]'
          }`}
          title={isMixerCollapsed ? t('mixer.show') : t('mixer.hide')}
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
          onRenamePlaylist={handleRenamePlaylist}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          activeSyncs={activeSyncs}
          width={sidebarWidth}
          theme={settings.theme}
        />

        {/* Resizer Splitter */}
        <div
          onMouseDown={handleMouseDownSplitter}
          className="relative w-[1px] bg-zinc-800 cursor-col-resize h-full select-none z-10 transition-colors duration-150 hover:bg-primary active:bg-primary group"
        >
          {/* Expanded interactive area */}
          <div className="absolute inset-y-0 -left-2 -right-2" />
        </div>

        {selectedPlaylistId && selectedPlaylist ? (
          <Tracklist
            playlistId={selectedPlaylistId}
            playlistTitle={selectedPlaylist.title}
            tracks={tracks}
            onLoadTrack={handleLoadTrack}
            onUpdateBpm={handleUpdateBpmInState}
            onUpdateKey={handleUpdateKeyInState}
            onUpdateRating={handleUpdateRatingInState}
            onReorderTracks={handleReorderTracks}
            currentTrackA={loadedTrackA}
            currentTrackB={loadedTrackB}
            activeDownloads={activeSyncs[selectedPlaylistId]?.activeDownloads}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-zinc-900/10 text-zinc-500 text-sm">
            {t('app.selectPlaylistPrompt')}
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

export default function App(): React.JSX.Element {
  const appState = useApp()
  const { settings, handleUpdateSettings } = appState

  return (
    <LanguageProvider
      language={settings.language || 'de'}
      setLanguage={async (lang) => {
        await handleUpdateSettings({ language: lang })
      }}
    >
      <AppContent appState={appState} />
    </LanguageProvider>
  )
}
