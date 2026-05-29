// src/types/electron.d.ts

// Definiere hier deine Kern-Datenstrukturen
interface Track {
  id: string
  filePath: string
  title: string
  bpm: number
}

// Das ist der Vertrag zwischen Backend (Main) und Frontend (Renderer)
export interface IRecordFoxAPI {
  scanLibrary: (folderPath: string) => Promise<Track[]>
  playTrack: (trackId: string) => void
  onTrackScanned: (callback: (track: Track) => void) => void
  getUsbDrives: () => Promise<{ name: string; path: string }[]>
  exportPlaylist: (
    playlistId: string,
    usbPath: string,
    forceOverwrite?: boolean
  ) => Promise<{ success: boolean; exists?: boolean; error?: string }>
  renamePlaylist: (id: string, newTitle: string) => Promise<{ success: boolean; error?: string }>
  onExportProgress: (
    callback: (data: {
      playlistId: string
      current: number
      total: number
      trackTitle: string
    }) => void
  ) => () => void
}

// Mache die API global für das Window-Objekt verfügbar
declare global {
  interface Window {
    api: IRecordFoxAPI
  }
}
