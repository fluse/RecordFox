import { BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, unlinkSync } from 'fs'
import {
  Playlist,
  Track,
  addTrack,
  deleteTrack,
  updatePlaylistStatus,
  getDownloadsDir,
  getCoversDir,
  getTracksForPlaylist,
  updateTrackBpm,
  updateTrackKey,
  getSettings,
  getPlaylists
} from './db'
import { getPlaylistInfo, downloadTrack } from './downloader'
import { analyzeBpm } from './bpm'
import { analyzeKey } from './key'
import nodeId3 from 'node-id3'

// Map of active synchronization tasks
const activeSyncs = new Map<string, boolean>()

// Parse YouTube video title to extract Artist and Title
export function parseTitleAndArtist(
  ytTitle: string,
  defaultUploader: string
): { title: string; artist: string } {
  const separators = [' - ', ' – ', ' — ', ' | ', ' ~ ']
  let artist = defaultUploader
  let title = ytTitle

  for (const sep of separators) {
    if (ytTitle.includes(sep)) {
      const parts = ytTitle.split(sep)
      artist = parts[0].trim()
      title = parts.slice(1).join(sep).trim()
      break
    }
  }

  // Remove common YouTube suffixes
  title = title
    .replace(
      /\s*[([{\s](official\s+(video|audio|lyric|music\s+video|visualizer|mv)|lyrics|official|hd|4k|clip\s+officiel|music\s+video|official\s+music\s+video)[)\]}\s]*/gi,
      ''
    )
    .trim()

  if (!title) {
    title = ytTitle
  }

  // Clean artist name as well
  artist = artist.replace(/\s*-\s*topic$/gi, '').trim()

  return { title, artist }
}

export async function syncPlaylist(playlist: Playlist, win: BrowserWindow): Promise<void> {
  if (activeSyncs.get(playlist.id)) {
    console.log(`Sync for playlist ${playlist.id} already running.`)
    return
  }

  activeSyncs.set(playlist.id, true)
  updatePlaylistStatus(playlist.id, 'syncing')
  win.webContents.send('sync-status-changed', playlist.id, 'syncing')

  try {
    const ytPlaylist = await getPlaylistInfo(playlist.url)
    const localTracks = getTracksForPlaylist(playlist.id)

    // Pre-create placeholder tracks in database for any new tracks in the playlist
    const localTrackIds = new Set(localTracks.map((t) => t.id))
    let addedPlaceholders = false
    for (const e of ytPlaylist.entries) {
      if (!localTrackIds.has(e.id)) {
        const { title, artist } = parseTitleAndArtist(e.title, e.uploader)
        const placeholderTrack: Track = {
          id: e.id,
          playlistId: playlist.id,
          title,
          artist,
          bpm: 0,
          duration: e.duration,
          filepath: '', // Empty path indicates placeholder / not downloaded yet
          coverPath: '',
          filesize: 0,
          format: 'MP3',
          rating: 0,
          bitrate: 0,
          key: ''
        }
        addTrack(placeholderTrack)
        addedPlaceholders = true
      }
    }

    // Refresh localTracks to include the newly added placeholders
    const currentLocalTracks = addedPlaceholders ? getTracksForPlaylist(playlist.id) : localTracks
    const currentLocalTrackIds = new Set(currentLocalTracks.map((t) => t.id))
    const ytTracksMap = new Map(ytPlaylist.entries.map((e) => [e.id, e]))

    const toDownload = ytPlaylist.entries.filter((e) => {
      if (!currentLocalTrackIds.has(e.id)) return true
      const track = currentLocalTracks.find((t) => t.id === e.id)
      if (!track || !existsSync(track.filepath) || !existsSync(track.coverPath)) {
        return true // Re-download if physical files are missing (required for audio/waveform)
      }
      return false
    })

    if (addedPlaceholders) {
      // Send IPC notification so the frontend can reload the track list immediately
      win.webContents.send('sync-status-changed', playlist.id, 'syncing')
    }

    // Check existing tracks for missing metadata (filesize, bitrate, format)
    const fs = require('fs')
    for (const track of localTracks) {
      if (ytTracksMap.has(track.id) && existsSync(track.filepath)) {
        let trackUpdated = false
        if (track.filesize === undefined || track.filesize === 0) {
          try {
            track.filesize = fs.statSync(track.filepath).size
            trackUpdated = true
          } catch (e) {
            console.error(`Failed to get size for ${track.filepath}:`, e)
          }
        }
        if (track.format === undefined) {
          track.format = 'MP3'
          trackUpdated = true
        }
        if (track.bitrate === undefined || track.bitrate === 0) {
          if (track.filesize && track.duration > 0) {
            track.bitrate = Math.round((track.filesize * 8) / (track.duration * 1000))
          } else {
            track.bitrate = 320
          }
          trackUpdated = true
        }
        if (trackUpdated) {
          addTrack(track) // update in database
        }
      }
    }

    const toDelete = currentLocalTracks.filter((t) => !ytTracksMap.has(t.id))

    // 1. Delete removed tracks
    for (const track of toDelete) {
      try {
        if (existsSync(track.filepath)) unlinkSync(track.filepath)
        if (existsSync(track.coverPath)) unlinkSync(track.coverPath)
      } catch (e) {
        console.error(`Error deleting files for track ${track.id}:`, e)
      }
      deleteTrack(track.id, playlist.id)
    }

    // 2. Download new tracks using concurrent workers based on settings
    const settings = getSettings()
    const maxWorkers = settings.maxWorkers || 1

    const downloadsDir = getDownloadsDir()
    const coversDir = getCoversDir()
    let downloadedCount = 0

    const queue = [...toDownload]

    const worker = async () => {
      const fs = require('fs')
      while (queue.length > 0) {
        const ytTrack = queue.shift()
        if (!ytTrack) break

        const sanitizedFilename = `${playlist.id}_${ytTrack.id}.mp3`
        const sanitizedCoverName = `${playlist.id}_${ytTrack.id}.jpg`
        const filepath = join(downloadsDir, sanitizedFilename)
        const coverPath = join(coversDir, sanitizedCoverName)

        const currentDownloadIndex = ++downloadedCount

        // Notify UI of start of download
        win.webContents.send('download-progress', {
          playlistId: playlist.id,
          trackId: ytTrack.id,
          title: ytTrack.title,
          percent: 0,
          current: currentDownloadIndex,
          total: toDownload.length
        })

        try {
          // Download
          await downloadTrack(ytTrack.id, filepath, coverPath, ytPlaylist.title, (percent) => {
            win.webContents.send('download-progress', {
              playlistId: playlist.id,
              trackId: ytTrack.id,
              title: ytTrack.title,
              percent,
              current: currentDownloadIndex,
              total: toDownload.length
            })
          })

          // Parse metadata & write ID3 (embed cover image as binary buffer)
          const { title, artist } = parseTitleAndArtist(ytTrack.title, ytTrack.uploader)
          const tags: any = {
            title,
            artist,
            album: ytPlaylist.title
          }
          if (fs.existsSync(coverPath)) {
            tags.image = {
              mime: 'image/jpeg',
              type: { id: 3, name: 'front cover' },
              description: 'Cover',
              imageBuffer: fs.readFileSync(coverPath)
            }
          }
          nodeId3.write(tags, filepath)

          // Fetch filesize & compute bitrate
          let filesize = 0
          let bitrate = 320
          try {
            if (fs.existsSync(filepath)) {
              filesize = fs.statSync(filepath).size
              if (ytTrack.duration > 0) {
                bitrate = Math.round((filesize * 8) / (ytTrack.duration * 1000))
              }
            }
          } catch (e) {
            console.error('Failed to get track filesize:', e)
          }

          // Add to database (bpm=0 initially, will be updated after analysis)
          const newTrack: Track = {
            id: ytTrack.id,
            playlistId: playlist.id,
            title,
            artist,
            bpm: 0,
            key: '',
            duration: ytTrack.duration,
            filepath,
            coverPath,
            filesize,
            format: 'MP3',
            rating: 0,
            bitrate
          }
          addTrack(newTrack)

          // Send 100% completion event
          win.webContents.send('download-progress', {
            playlistId: playlist.id,
            trackId: ytTrack.id,
            title: ytTrack.title,
            percent: 100,
            current: currentDownloadIndex,
            total: toDownload.length
          })

          // Analyze BPM and Key in the background (non-blocking, run in parallel)
          analyzeBpm(filepath)
            .then((bpm) => {
              if (bpm > 0) {
                updateTrackBpm(ytTrack.id, playlist.id, bpm)
                if (!win.isDestroyed()) {
                  win.webContents.send('bpm-analyzed', ytTrack.id, playlist.id, bpm)
                }
              }
            })
            .catch((err) => {
              console.error(`BPM analysis failed for track ${ytTrack.id}:`, err)
            })

          analyzeKey(filepath)
            .then(({ camelot, tkey }) => {
              if (camelot) {
                updateTrackKey(ytTrack.id, playlist.id, camelot, tkey)
                if (!win.isDestroyed()) {
                  win.webContents.send('key-analyzed', ytTrack.id, playlist.id, camelot)
                }
              }
            })
            .catch((err) => {
              console.error(`Key analysis failed for track ${ytTrack.id}:`, err)
            })
        } catch (err) {
          console.error(`Failed to download track ${ytTrack.id}:`, err)
          // Send completion event even on failure so progress bar advances and UI cleans up
          win.webContents.send('download-progress', {
            playlistId: playlist.id,
            trackId: ytTrack.id,
            title: ytTrack.title,
            percent: 100,
            current: currentDownloadIndex,
            total: toDownload.length
          })
        }
      }
    }

    const workers: Promise<void>[] = []
    const numWorkers = Math.max(1, Math.min(12, maxWorkers))
    for (let i = 0; i < numWorkers; i++) {
      workers.push(worker())
    }

    await Promise.all(workers)

    // Update Sync Time
    const now = new Date().toISOString()
    updatePlaylistStatus(playlist.id, 'idle', now)
    win.webContents.send('sync-status-changed', playlist.id, 'idle', now)
  } catch (e) {
    console.error(`Sync failed for playlist ${playlist.id}:`, e)
    updatePlaylistStatus(playlist.id, 'error')
    win.webContents.send('sync-status-changed', playlist.id, 'error')
  } finally {
    activeSyncs.delete(playlist.id)
  }
}

// Background Cron-Sync for all playlists
let syncInterval: NodeJS.Timeout | null = null

export function startBackgroundSync(win: BrowserWindow, intervalMs = 30 * 60 * 1000): void {
  if (syncInterval) clearInterval(syncInterval)

  syncInterval = setInterval(() => {
    const playlists = getPlaylists()
    for (const playlist of playlists) {
      syncPlaylist(playlist, win).catch((err) => console.error(err))
    }
  }, intervalMs)
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}
