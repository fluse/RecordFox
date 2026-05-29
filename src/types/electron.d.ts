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
  scanLibrary: (folderPath: string) => Promise<Track[]>;
  playTrack: (trackId: string) => void;
  onTrackScanned: (callback: (track: Track) => void) => void;
}

// Mache die API global für das Window-Objekt verfügbar
declare global {
  interface Window {
    api: IRecordFoxAPI;
  }
}