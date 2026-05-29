import React, { useRef, useState, useEffect } from 'react'
import { Play, Pause, Lock, Unlock } from 'lucide-react'
import type { Track } from '@main/db'
import { getMediaUrl, formatDuration } from '../utils/audio'

interface DeckProps {
  deckId: 'A' | 'B'
  track: Track | null
  audioContext: AudioContext | null
  masterGain: GainNode | null
  crossfaderGainA: GainNode | null
  crossfaderGainB: GainNode | null
  onUpdateBpm: (bpm: number) => void
  opponentBpm: number | null
  eqLowVal: number
  eqMidVal: number
  eqHighVal: number
  volumeVal: number
  onLoadTrack: (track: Track) => void
}

export default function Deck({
  deckId,
  track,
  audioContext,
  masterGain,
  crossfaderGainA,
  crossfaderGainB,
  opponentBpm,
  eqLowVal,
  eqMidVal,
  eqHighVal,
  volumeVal,
  onLoadTrack
}: DeckProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Web Audio Nodes refs
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const filterLowRef = useRef<BiquadFilterNode | null>(null)
  const filterMidRef = useRef<BiquadFilterNode | null>(null)
  const filterHighRef = useRef<BiquadFilterNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  // Waveform peak data
  const [peaks, setPeaks] = useState<number[]>([])
  const [decoding, setDecoding] = useState(false)

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [pitch, setPitch] = useState(1.0) // 1.0 = normal, ±16%
  const [keyLock, setKeyLock] = useState(true) // preserves pitch
  const [cueTime, setCueTime] = useState<number | null>(null)

  // Looping state
  const [loopStart, setLoopStart] = useState<number | null>(null)
  const [loopEnd, setLoopEnd] = useState<number | null>(null)
  const [activeLoopBeats, setActiveLoopBeats] = useState<number | null>(null)

  // Drag and drop states
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const dataStr = e.dataTransfer.getData('text/plain')
      if (dataStr) {
        const draggedTrack = JSON.parse(dataStr) as Track
        onLoadTrack(draggedTrack)
      }
    } catch (err) {
      console.error('Failed to parse dropped track:', err)
    }
  }

  const activeColor = deckId === 'A' ? '#a855f7' : '#9333ea' // Purple-500 or Purple-600

  // 1. Initialize HTML5 Audio Element & Web Audio nodes
  useEffect(() => {
    if (!audioContext || !masterGain || !crossfaderGainA || !crossfaderGainB) return

    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audioRef.current = audio

    // Create Nodes
    sourceNodeRef.current = audioContext.createMediaElementSource(audio)
    filterLowRef.current = audioContext.createBiquadFilter()
    filterMidRef.current = audioContext.createBiquadFilter()
    filterHighRef.current = audioContext.createBiquadFilter()
    gainNodeRef.current = audioContext.createGain()

    // Configure EQs
    filterLowRef.current.type = 'lowshelf'
    filterLowRef.current.frequency.value = 250
    
    filterMidRef.current.type = 'peaking'
    filterMidRef.current.frequency.value = 1000
    filterMidRef.current.Q.value = 1.0

    filterHighRef.current.type = 'highshelf'
    filterHighRef.current.frequency.value = 4000

    // Connect Node Graph: Source -> Low EQ -> Mid EQ -> High EQ -> Gain -> Crossfader Gain -> Master Gain
    sourceNodeRef.current
      .connect(filterLowRef.current)
      .connect(filterMidRef.current)
      .connect(filterHighRef.current)
      .connect(gainNodeRef.current)

    const targetCrossfader = deckId === 'A' ? crossfaderGainA : crossfaderGainB
    gainNodeRef.current.connect(targetCrossfader)

    // Set initial values
    gainNodeRef.current.gain.value = volumeVal
    setEqNode('low', eqLowVal)
    setEqNode('mid', eqMidVal)
    setEqNode('high', eqHighVal)

    // Audio Listeners
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      
      // Handle Loop
      if (loopStart !== null && loopEnd !== null) {
        if (audio.currentTime >= loopEnd) {
          audio.currentTime = loopStart
        }
      }
    }
    const onLoadedMetadata = () => {
      setDuration(audio.duration)
      setCueTime(0) // Default Cue point is start of track
    }
    const onEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      
      // Disconnect Nodes
      try {
        sourceNodeRef.current?.disconnect()
        filterLowRef.current?.disconnect()
        filterMidRef.current?.disconnect()
        filterHighRef.current?.disconnect()
        gainNodeRef.current?.disconnect()
      } catch (e) {
        console.error(e)
      }
    }
  }, [audioContext, masterGain, crossfaderGainA, crossfaderGainB])

  // Update Node Values on Prop changes (from Mixer)
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volumeVal
    }
  }, [volumeVal])

  useEffect(() => {
    setEqNode('low', eqLowVal)
  }, [eqLowVal])

  useEffect(() => {
    setEqNode('mid', eqMidVal)
  }, [eqMidVal])

  useEffect(() => {
    setEqNode('high', eqHighVal)
  }, [eqHighVal])

  const setEqNode = (type: 'low' | 'mid' | 'high', dB: number) => {
    const node = 
      type === 'low' ? filterLowRef.current : 
      type === 'mid' ? filterMidRef.current : filterHighRef.current
    if (node) {
      // mapping -12 to 12 range
      node.gain.setValueAtTime(dB, audioContext?.currentTime || 0)
    }
  }

  // 2. Load Track & Generate Peaks for Waveform
  useEffect(() => {
    if (!track || !audioRef.current) {
      setPeaks([])
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      return
    }

    // Load audio element
    audioRef.current.src = getMediaUrl(track.filepath)
    audioRef.current.load()
    setIsPlaying(false)
    setCurrentTime(0)
    setPitch(1.0)
    setLoopStart(null)
    setLoopEnd(null)
    setActiveLoopBeats(null)

    // Decode full track for waveform canvas peaks
    const loadWaveform = async () => {
      setDecoding(true)
      try {
        const url = getMediaUrl(track.filepath)
        const response = await fetch(url)
        const arrayBuffer = await response.arrayBuffer()
        
        // Decode offscreen
        const offlineContext = new OfflineAudioContext(1, 44100 * 30, 44100) // decode up to first 30 seconds for detail, or more
        const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer)
        
        const channelData = audioBuffer.getChannelData(0)
        const step = Math.ceil(channelData.length / 500) // 500 bars
        const generatedPeaks: number[] = []

        for (let i = 0; i < channelData.length; i += step) {
          let max = 0
          for (let j = 0; j < step && i + j < channelData.length; j++) {
            const val = Math.abs(channelData[i + j])
            if (val > max) max = val
          }
          generatedPeaks.push(max)
        }
        setPeaks(generatedPeaks)
      } catch (e) {
        console.error('Failed to decode waveform:', e)
      } finally {
        setDecoding(false)
      }
    }

    loadWaveform()
  }, [track])

  // 3. Draw Waveform (Scrolling during play)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || decoding) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const width = canvas.width
      const height = canvas.height
      const centerY = height / 2

      // Draw Grid / Center Playhead Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.beginPath()
      ctx.moveTo(width / 2, 0)
      ctx.lineTo(width / 2, height)
      ctx.stroke()

      if (peaks.length > 0 && duration > 0) {
        // Calculate index of peaks corresponding to currentTime
        const progress = currentTime / duration
        const centerIndex = Math.floor(progress * peaks.length)

        // Waveform zoom / width in terms of peak index span (say, view 80 peaks on screen)
        const span = 80
        const start = centerIndex - span / 2
        const end = centerIndex + span / 2

        ctx.lineWidth = 3
        ctx.lineCap = 'round'

        for (let i = start; i < end; i++) {
          const x = ((i - start) / span) * width
          
          let peakValue = 0
          if (i >= 0 && i < peaks.length) {
            peakValue = peaks[i]
          }

          // Dynamic coloring: active color for past track, gray for future track
          if (i < centerIndex) {
            ctx.strokeStyle = activeColor
          } else {
            ctx.strokeStyle = '#3f3f46' // zinc-700
          }

          const h = peakValue * height * 0.95
          ctx.beginPath()
          ctx.moveTo(x, centerY - h / 2)
          ctx.lineTo(x, centerY + h / 2)
          ctx.stroke()
        }

        // Render Loop markers
        if (loopStart !== null && duration > 0) {
          const startProgress = loopStart / duration
          const startIdx = Math.floor(startProgress * peaks.length)
          const startX = ((startIdx - start) / span) * width

          ctx.fillStyle = 'rgba(168, 85, 247, 0.2)' // purple overlay
          
          if (loopEnd !== null) {
            const endProgress = loopEnd / duration
            const endIdx = Math.floor(endProgress * peaks.length)
            const endX = ((endIdx - start) / span) * width

            ctx.fillRect(startX, 0, endX - startX, height)
            ctx.strokeStyle = '#d8b4fe' // purple-300
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.moveTo(startX, 0)
            ctx.lineTo(startX, height)
            ctx.moveTo(endX, 0)
            ctx.lineTo(endX, height)
            ctx.stroke()
          }
        }
      } else {
        // Flat line if no track or decoding
        ctx.strokeStyle = '#27272a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(0, centerY)
        ctx.lineTo(width, centerY)
        ctx.stroke()

        if (decoding) {
          ctx.fillStyle = '#a1a1aa'
          ctx.font = '10px sans-serif'
          ctx.fillText('Dekodiere Welle...', 12, centerY - 8)
        }
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [peaks, currentTime, duration, decoding, loopStart, loopEnd])

  // Play / Pause
  const togglePlay = async () => {
    if (!audioRef.current || !track) return
    
    // Resume context if suspended (browser security)
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(e => console.error(e))
    }
  }

  // Cue Button Logic
  // Pressing Cue goes back to cuePoint and pauses.
  // Holding Cue (not fully simulated in click, but clicking acts as instantaneous cue jumping)
  const handleCue = () => {
    if (!audioRef.current || !track) return
    if (cueTime !== null) {
      audioRef.current.currentTime = cueTime
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }

  const setCuePoint = () => {
    if (!audioRef.current || !track) return
    setCueTime(audioRef.current.currentTime)
  }

  // Pitch (Playback Rate) Adjustment
  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseFloat(e.target.value)
    setPitch(p)
    if (audioRef.current) {
      audioRef.current.playbackRate = p
    }
  }

  // Toggle Key Lock (preservesPitch)
  const toggleKeyLock = () => {
    const next = !keyLock
    setKeyLock(next)
    if (audioRef.current) {
      audioRef.current.preservesPitch = next
    }
  }

  // Beat Looping
  const handleBeatLoop = (beats: number) => {
    if (!audioRef.current || !track || track.bpm === 0) return

    if (activeLoopBeats === beats) {
      // Turn off loop
      setLoopStart(null)
      setLoopEnd(null)
      setActiveLoopBeats(null)
      return
    }

    const current = audioRef.current.currentTime
    const secondsPerBeat = 60 / track.bpm
    const loopDuration = beats * secondsPerBeat

    setLoopStart(current)
    setLoopEnd(current + loopDuration)
    setActiveLoopBeats(beats)
  }

  // Sync tempo with opponent deck BPM
  const handleSync = () => {
    if (!track || track.bpm === 0 || !opponentBpm || opponentBpm === 0) return
    // Calculate required pitch factor: target BPM / original BPM
    const targetPitch = opponentBpm / track.bpm
    // Clip targetPitch between 0.84 and 1.16 (±16%)
    const clippedPitch = Math.max(0.84, Math.min(1.16, targetPitch))
    setPitch(clippedPitch)
    if (audioRef.current) {
      audioRef.current.playbackRate = clippedPitch
    }
  }

  const currentBpm = track && track.bpm > 0 ? Math.round(track.bpm * pitch) : 0

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col border p-4 rounded-xl shadow-lg relative select-none w-[420px] transition-all duration-200 ${
        isDragOver 
          ? deckId === 'A' 
            ? 'border-primary ring-2 ring-primary/20 bg-primary/5 scale-[1.01]' 
            : 'border-purple-600 ring-2 ring-purple-600/20 bg-purple-600/5 scale-[1.01]' 
          : 'border-zinc-900 bg-zinc-950'
      } ${
        deckId === 'A' ? 'border-l-primary/30' : 'border-r-primary/30'
      }`}
    >
      {/* Deck Header Info */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
        <div className="truncate max-w-[240px]">
          <div className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            DECK {deckId}
          </div>
          <div className="text-sm font-bold text-zinc-200 truncate">
            {track ? track.title : 'Kein Track geladen'}
          </div>
          <div className="text-xs text-zinc-500 truncate">
            {track ? track.artist : '---'}
          </div>
        </div>

        {/* BPM & TIME Info */}
        <div className="text-right">
          <div className="text-lg font-black text-primary font-mono leading-none">
            {currentBpm > 0 ? currentBpm : '0.0'}
            <span className="text-[10px] font-normal text-zinc-600 ml-1">BPM</span>
          </div>
          {track && track.bpm > 0 && Math.abs(pitch - 1.0) > 0.001 && (
            <div className="text-[10px] font-mono text-zinc-500">
              Orig: {track.bpm} ({((pitch - 1.0) * 100).toFixed(1)}%)
            </div>
          )}
          <div className="mt-1 text-sm font-bold text-zinc-300 font-mono leading-none">
            {track ? formatDuration(Math.max(0, duration - currentTime)) : '0:00'}
            <span className="text-[9px] font-semibold text-zinc-600 ml-1 uppercase">Rem</span>
          </div>
        </div>
      </div>

      {/* Waveform Screen */}
      <div className="relative my-3 h-20 w-full overflow-hidden rounded-lg bg-zinc-900/50 border border-zinc-900">
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={80} 
          className="absolute inset-0 h-full w-full"
        />
        {/* Timing Overlay */}
        <div className="absolute bottom-1 right-2 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </div>
      </div>

      {/* Controls: Play/Pause, Cue, Loop, Pitch */}
      <div className="grid grid-cols-12 gap-3 pt-2">
        
        {/* LEFT COLUMN: Play, Cue, Sync */}
        <div className="col-span-8 space-y-3">
          <div className="flex gap-2">
            <button
              onClick={togglePlay}
              disabled={!track}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2.5 font-bold transition duration-150 ${
                isPlaying 
                  ? 'bg-zinc-800 text-primary hover:bg-zinc-700' 
                  : 'bg-primary text-white hover:bg-primary/95 shadow-md shadow-primary/10'
              } disabled:opacity-30`}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 fill-current" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" /> Play
                </>
              )}
            </button>

            <button
              onClick={handleCue}
              disabled={!track}
              className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white font-bold py-2.5 text-center transition disabled:opacity-30"
            >
              CUE
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={setCuePoint}
              disabled={!track}
              title="Aktuelle Position als Cue setzen"
              className="flex-1 text-center py-1.5 rounded bg-zinc-900 text-xs font-semibold text-zinc-400 border border-zinc-900 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
            >
              Set Cue
            </button>
            <button
              onClick={handleSync}
              disabled={!track || !opponentBpm || opponentBpm === 0}
              className="flex-1 text-center py-1.5 rounded bg-amber-600/10 hover:bg-amber-600/20 text-xs font-bold text-amber-500 border border-amber-600/30 transition disabled:opacity-30"
            >
              SYNC
            </button>
          </div>

          {/* Quick Loops */}
          <div className="space-y-1.5 border-t border-zinc-900/60 pt-2.5">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              Autoloop (Beats)
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 4, 8].map((beats) => {
                const isCurrent = activeLoopBeats === beats
                return (
                  <button
                    key={beats}
                    onClick={() => handleBeatLoop(beats)}
                    disabled={!track || !track.bpm}
                    className={`flex-1 text-xs font-bold py-1.5 rounded transition ${
                      isCurrent 
                        ? 'bg-primary text-white font-black' 
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-900 hover:bg-zinc-800 hover:text-zinc-200'
                    } disabled:opacity-30`}
                  >
                    {beats}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Pitch slider */}
        <div className="col-span-4 flex flex-col items-center border-l border-zinc-900 pl-3">
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
            PITCH
          </div>
          <div className="flex-1 flex items-center justify-center relative w-full h-[100px]">
            <input
              type="range"
              min="0.84"
              max="1.16"
              step="0.005"
              value={pitch}
              onChange={handlePitchChange}
              disabled={!track}
              className="absolute accent-primary h-2 w-[100px] cursor-pointer rotate-270 bg-zinc-900 rounded-lg outline-none"
            />
          </div>
          {/* Key Lock */}
          <button
            onClick={toggleKeyLock}
            disabled={!track}
            className={`mt-2 flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition ${
              keyLock 
                ? 'bg-zinc-900 text-primary border border-primary/30' 
                : 'bg-zinc-950 text-zinc-500 border border-zinc-900'
            } disabled:opacity-30`}
          >
            {keyLock ? (
              <>
                <Lock className="h-3 w-3" /> KeyLock
              </>
            ) : (
              <>
                <Unlock className="h-3 w-3" /> KeyLock
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
