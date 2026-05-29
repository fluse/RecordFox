import { app, shell, BrowserWindow, ipcMain, protocol, net, dialog } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { 
  initDb, 
  getPlaylists, 
  addPlaylist as addPlaylistToDb, 
  deletePlaylist as deletePlaylistFromDb, 
  getTracksForPlaylist, 
  updateTrackBpm,
  updateTrackRating,
  getSettings,
  updateSettings,
  migrateDownloadsFolder,
  Playlist,
  AppSettings
} from './db'
import { getPlaylistInfo, ensureYtdlp } from './downloader'
import { syncPlaylist, startBackgroundSync, stopBackgroundSync } from './sync'

// Register custom media protocol to serve local MP3 files securely and support audio streaming/seeking
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, stream: true, corsEnabled: true } }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Initialize Database and folders
  initDb()

  // Ensure yt-dlp binary is downloaded/present
  try {
    await ensureYtdlp()
  } catch (err) {
    console.error('Failed to ensure yt-dlp at startup:', err)
  }

  // Register custom media protocol
  protocol.handle('media', (request) => {
    try {
      const url = new URL(request.url)
      let filePath = decodeURIComponent(url.pathname)
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1)
      }
      return net.fetch(pathToFileURL(filePath).toString())
    } catch (err) {
      console.error('Failed to handle media protocol request:', err)
      return new Response('File not found', { status: 404 })
    }
  })

  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC Event Handlers
  ipcMain.handle('playlists:get', () => {
    return getPlaylists()
  })

  ipcMain.handle('playlists:add', async (_, url: string) => {
    try {
      const ytInfo = await getPlaylistInfo(url)
      const newPlaylist: Playlist = {
        id: ytInfo.id,
        title: ytInfo.title,
        url: url,
        syncStatus: 'idle',
        lastSync: ''
      }
      addPlaylistToDb(newPlaylist)
      
      // Trigger sync in background immediately
      if (mainWindow) {
        syncPlaylist(newPlaylist, mainWindow).catch(err => console.error('Sync failed:', err))
      }

      return { success: true, playlist: newPlaylist }
    } catch (e: any) {
      console.error('Error adding playlist:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('playlists:delete', (_, id: string) => {
    try {
      deletePlaylistFromDb(id)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('playlists:sync', (_, id: string) => {
    const playlist = getPlaylists().find(p => p.id === id)
    if (playlist && mainWindow) {
      syncPlaylist(playlist, mainWindow).catch(err => console.error('Manual sync failed:', err))
      return { success: true }
    }
    return { success: false, error: 'Playlist not found' }
  })

  ipcMain.handle('tracks:get', (_, playlistId: string) => {
    return getTracksForPlaylist(playlistId)
  })

  ipcMain.handle('tracks:update-bpm', (_, trackId: string, playlistId: string, bpm: number) => {
    try {
      updateTrackBpm(trackId, playlistId, bpm)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('tracks:update-rating', (_, trackId: string, playlistId: string, rating: number) => {
    try {
      updateTrackRating(trackId, playlistId, rating)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', (_, settings: Partial<AppSettings>) => {
    try {
      updateSettings(settings)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('settings:migrate', async (_, newPath: string, moveFiles: boolean) => {
    try {
      await migrateDownloadsFolder(newPath, moveFiles)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('settings:open-path', async (_, folderPath: string) => {
    try {
      await shell.openPath(folderPath)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('dialog:select-directory', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:confirm-migration', async () => {
    if (!mainWindow) return 'cancel'
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Ja, verschieben', 'Nein, nur Pfad ändern', 'Abbrechen'],
      defaultId: 0,
      title: 'Speicherort verschieben',
      message: 'Möchtest du die existierenden Musikdateien und Playlisten in den neuen Ordner verschieben?',
      detail: 'Wenn du Verschieben wählst, werden alle MP3s und Cover an den neuen Ort kopiert/verschoben. Wenn du Nein wählst, verbleiben sie am alten Ort.'
    })
    if (result.response === 0) return 'move'
    if (result.response === 1) return 'change'
    return 'cancel'
  })

  ipcMain.on('log-error', (_, msg) => {
    console.error('[Renderer Error]', msg)
  })

  createWindow()

  // Start Background Sync Scheduler
  if (mainWindow) {
    startBackgroundSync(mainWindow)
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopBackgroundSync()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
