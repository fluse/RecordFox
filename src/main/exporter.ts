import { copyFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join, extname } from 'path'
import { BrowserWindow } from 'electron'
import { getTracksForPlaylist, getPlaylists } from './db'

export async function exportPlaylistToUsb(
  playlistId: string,
  usbPath: string,
  win: BrowserWindow,
  forceOverwrite = false
): Promise<{ success: boolean; exists?: boolean; error?: string }> {
  try {
    const playlist = getPlaylists().find((p) => p.id === playlistId)
    if (!playlist) {
      return { success: false, error: 'Playlist nicht gefunden' }
    }

    const tracks = getTracksForPlaylist(playlistId).filter(
      (t) => t.filepath && existsSync(t.filepath)
    )
    if (tracks.length === 0) {
      return { success: false, error: 'Keine heruntergeladenen Titel in dieser Playlist vorhanden' }
    }

    // Prepare paths
    const exportFolderBase = join(usbPath, 'RecordFox_Export')
    const playlistFolderName = sanitizeFolderName(playlist.title)
    const exportFolderPlaylist = join(exportFolderBase, playlistFolderName)
    const m3uPath = join(exportFolderBase, `${playlistFolderName}.m3u8`)

    // Overwrite Check: If folder or playlist file exists, prompt user via UI by returning 'exists'
    const folderExists = existsSync(exportFolderPlaylist)
    const m3uExists = existsSync(m3uPath)

    if ((folderExists || m3uExists) && !forceOverwrite) {
      return { success: false, exists: true }
    }

    // Clean up old folder if force-overwriting
    if (forceOverwrite && folderExists) {
      if (exportFolderPlaylist.includes('RecordFox_Export') && playlistFolderName.length > 0) {
        try {
          rmSync(exportFolderPlaylist, { recursive: true, force: true })
        } catch (rmErr) {
          console.error(`Failed to clean old directory ${exportFolderPlaylist}:`, rmErr)
        }
      }
    }

    // Re-create folder
    if (!existsSync(exportFolderPlaylist)) {
      mkdirSync(exportFolderPlaylist, { recursive: true })
    }

    const m3uLines: string[] = ['#EXTM3U']

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]

      // Notify progress to UI
      if (win && !win.isDestroyed()) {
        win.webContents.send('export-progress', {
          playlistId,
          current: i + 1,
          total: tracks.length,
          trackTitle: `${track.artist} - ${track.title}`
        })
      }

      const fileExt = extname(track.filepath) || '.mp3'
      const sanitizedFilename = sanitizeFilename(`${track.artist} - ${track.title}`) + fileExt
      const targetFilePath = join(exportFolderPlaylist, sanitizedFilename)

      // Copy file to USB
      try {
        copyFileSync(track.filepath, targetFilePath)
      } catch (copyErr: unknown) {
        console.error(`Failed to copy ${track.filepath} to ${targetFilePath}:`, copyErr)
        // Continue copying other tracks even if one fails
      }

      // Add to M3U8 list
      // Relative path: from [usbPath]/RecordFox_Export/[playlist].m3u8
      // to [usbPath]/RecordFox_Export/[playlist]/[track].mp3
      // is [playlist]/[track].mp3
      const relativePath = `${playlistFolderName}/${sanitizedFilename}`
      m3uLines.push(`#EXTINF:${Math.round(track.duration)},${track.artist} - ${track.title}`)
      m3uLines.push(relativePath)
    }

    // Write M3U8 file in UTF-8 format
    writeFileSync(m3uPath, m3uLines.join('\n'), 'utf8')

    return { success: true }
  } catch (err: unknown) {
    console.error('Export failed:', err)
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { success: false, error: errorMsg || 'Export fehlgeschlagen' }
  }
}

function sanitizeFolderName(name: string): string {
  // Replace characters not allowed in filenames across FAT32/exFAT filesystems
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

function sanitizeFilename(name: string): string {
  // Replace characters not allowed in filenames across FAT32/exFAT filesystems
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}
