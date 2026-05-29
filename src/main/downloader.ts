import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, chmodSync, writeFileSync, unlinkSync } from 'fs'
import { execFile, spawn } from 'child_process'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

const ffmpegPath = ffmpegInstaller.path

export function getBinDir(): string {
  const userData = app.getPath('userData')
  const binDir = join(userData, 'bin')
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true })
  }
  return binDir
}

export function getYtdlpPath(): string {
  return join(getBinDir(), 'yt-dlp')
}

// Ensure yt-dlp is downloaded and executable
export async function ensureYtdlp(onProgress?: (msg: string) => void): Promise<string> {
  const ytdlpPath = getYtdlpPath()
  if (existsSync(ytdlpPath)) {
    return ytdlpPath
  }

  if (onProgress) onProgress('yt-dlp wird heruntergeladen...')
  
  const url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download yt-dlp: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  writeFileSync(ytdlpPath, buffer)
  chmodSync(ytdlpPath, 0o755) // Make executable

  if (onProgress) onProgress('yt-dlp erfolgreich eingerichtet.')
  return ytdlpPath
}

export interface YtVideo {
  id: string;
  title: string;
  duration: number; // in seconds
  uploader: string;
}

export interface YtPlaylist {
  id: string;
  title: string;
  entries: YtVideo[];
}

// Fetch playlist information
export function getPlaylistInfo(playlistUrl: string): Promise<YtPlaylist> {
  return new Promise(async (resolve, reject) => {
    try {
      const ytdlpPath = await ensureYtdlp()
      const args = [
        '--dump-single-json',
        '--flat-playlist',
        '--no-warnings',
        playlistUrl
      ]

      execFile(ytdlpPath, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`yt-dlp failed: ${error.message}. Stderr: ${stderr}`))
        }

        try {
          const data = JSON.parse(stdout)
          const entries: YtVideo[] = (data.entries || []).map((entry: any) => ({
            id: entry.id,
            title: entry.title || 'Unknown Title',
            duration: entry.duration || 0,
            uploader: entry.uploader || entry.channel || 'Unknown Artist'
          }))

          resolve({
            id: data.id || '',
            title: data.title || 'YouTube Playlist',
            entries
          })
        } catch (e) {
          reject(new Error(`Failed to parse playlist JSON: ${e}`))
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}

// Download a track as MP3 and write metadata
export function downloadTrack(
  videoId: string,
  outputPath: string,
  coverPath: string,
  _playlistTitle: string,
  progressCallback: (percent: number) => void
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const ytdlpPath = await ensureYtdlp()
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

      // Steps:
      // 1. Download cover art first
      try {
        const coverUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        const res = await fetch(coverUrl)
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer()
          writeFileSync(coverPath, Buffer.from(arrayBuffer))
        }
      } catch (e) {
        console.error('Failed to download cover art:', e)
      }

      // 2. Download audio and convert to MP3
      // We write to a temporary file first
      const tempOutputTemplate = outputPath.replace(/\.mp3$/, '.temp.%(ext)s')
      const finalTempOutput = outputPath.replace(/\.mp3$/, '.temp.mp3')

      const args = [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '320k', // Highest quality
        '--ffmpeg-location', ffmpegPath,
        '--no-playlist',
        '--newline',
        '-o', tempOutputTemplate,
        videoUrl
      ]

      const child = spawn(ytdlpPath, args)

      child.stdout.on('data', (data) => {
        const output = data.toString()
        // Parse progress e.g. "[download]  45.3% of ~10.42MiB at  3.12MiB/s ETA 00:02"
        const match = output.match(/\[download\]\s+(\d+\.\d+)%/)
        if (match) {
          const percent = parseFloat(match[1])
          // Download is the first 85% of the total process
          progressCallback(Math.floor(percent * 0.85))
        } else if (output.includes('[ExtractAudio]')) {
          progressCallback(95)
        }
      })

      child.stderr.on('data', (data) => {
        console.error('yt-dlp stderr:', data.toString())
      })

      child.on('close', (code) => {
        if (code !== 0) {
          if (existsSync(finalTempOutput)) unlinkSync(finalTempOutput)
          return reject(new Error(`yt-dlp download failed with code ${code}`))
        }

        // Rename temp file to target path
        if (existsSync(finalTempOutput)) {
          // 3. Write ID3 metadata
          try {
            // Read title and artist from file or video info
            // Let's first rename it
            const fs = require('fs')
            fs.renameSync(finalTempOutput, outputPath)

            // Parse Artist - Title
            // We will fetch title info from yt-dlp first or pass it
            // Let's resolve the promise after setting metadata in db.ts update or here
            resolve()
          } catch (e) {
            reject(new Error(`Failed to finalize MP3 file: ${e}`))
          }
        } else {
          reject(new Error(`Temp file not found at ${finalTempOutput}`))
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}
