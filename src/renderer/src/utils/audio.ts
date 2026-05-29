import MusicTempo from 'music-tempo'

// Convert a file path to the custom media URL
export function getMediaUrl(filepath: string): string {
  const normalizedPath = filepath.replace(/\\/g, '/')
  const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/')
  return `media://${encodedPath}`
}

// Decode audio file and compute BPM using music-tempo
export async function calculateBpm(filepath: string): Promise<number> {
  const url = getMediaUrl(filepath)
  
  // 1. Fetch the file data
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch audio for BPM analysis: ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()

  // 2. Decode the audio data using OfflineAudioContext (bypasses autoplay policy and hardware limits)
  const offlineCtx = new OfflineAudioContext(1, 44100 * 30, 44100)
  const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer)
  
  // We only need one channel for beat detection (mono is fine)
  const channelData = audioBuffer.getChannelData(0)

  // Slice to first 60 seconds to speed up analysis and prevent thread blocking
  const sliceLength = Math.min(channelData.length, 44100 * 60)
  const slicedData = channelData.slice(0, sliceLength)
  
  // Run music-tempo beat detection
  const mt = new MusicTempo(slicedData)
  
  // Return rounded tempo
  return Math.round(mt.tempo)
}

// Format duration from seconds to MM:SS
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}
