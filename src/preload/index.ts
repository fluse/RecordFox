import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  getPlaylists: () => ipcRenderer.invoke('playlists:get'),
  addPlaylist: (url: string) => ipcRenderer.invoke('playlists:add', url),
  deletePlaylist: (id: string) => ipcRenderer.invoke('playlists:delete', id),
  syncPlaylist: (id: string) => ipcRenderer.invoke('playlists:sync', id),
  
  getTracks: (playlistId: string) => ipcRenderer.invoke('tracks:get', playlistId),
  updateTrackBpm: (trackId: string, playlistId: string, bpm: number) => 
    ipcRenderer.invoke('tracks:update-bpm', trackId, playlistId, bpm),
  updateTrackRating: (trackId: string, playlistId: string, rating: number) =>
    ipcRenderer.invoke('tracks:update-rating', trackId, playlistId, rating),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  migrateSettings: (newPath: string, moveFiles: boolean) => ipcRenderer.invoke('settings:migrate', newPath, moveFiles),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  confirmMigration: () => ipcRenderer.invoke('dialog:confirm-migration'),
  openPath: (path: string) => ipcRenderer.invoke('settings:open-path', path),

  // Sync / Download events listeners
  onSyncStatusChanged: (callback: (playlistId: string, status: string, lastSync?: string) => void) => {
    const subscription = (_event: any, playlistId: string, status: string, lastSync?: string) => 
      callback(playlistId, status, lastSync)
    ipcRenderer.on('sync-status-changed', subscription)
    return () => {
      ipcRenderer.removeListener('sync-status-changed', subscription)
    }
  },

  onDownloadProgress: (callback: (data: {
    playlistId: string;
    trackId: string;
    title: string;
    percent: number;
    current: number;
    total: number;
  }) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('download-progress', subscription)
    return () => {
      ipcRenderer.removeListener('download-progress', subscription)
    }
  },

  logError: (message: string) => ipcRenderer.send('log-error', message)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Error exposing preload api:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
