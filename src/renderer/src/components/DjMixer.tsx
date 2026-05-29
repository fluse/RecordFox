import React, { useState, useEffect, useRef } from 'react'
import Deck from './Deck'
import Mixer from './Mixer'
import type { Track } from '@main/db'

interface DjMixerProps {
  trackA: Track | null
  trackB: Track | null
  onUpdateBpm: (trackId: string, bpm: number) => void
  onLoadTrack: (track: Track, deck: 'A' | 'B') => void
}

export default function DjMixer({
  trackA,
  trackB,
  onUpdateBpm,
  onLoadTrack
}: DjMixerProps): React.JSX.Element {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)

  // Gain Nodes refs to dynamically update volume/master/crossfader values
  const masterGainRef = useRef<GainNode | null>(null)
  const crossfaderGainARef = useRef<GainNode | null>(null)
  const crossfaderGainBRef = useRef<GainNode | null>(null)

  // Mixer parameters in React state (to bind UI with Web Audio nodes)
  const [masterVolume, setMasterVolume] = useState(0.8)
  const [crossfader, setCrossfader] = useState(0.0) // -1 (A) to +1 (B)

  const [volumeA, setVolumeA] = useState(0.9)
  const [eqLowA, setEqLowA] = useState(0)
  const [eqMidA, setEqMidA] = useState(0)
  const [eqHighA, setEqHighA] = useState(0)

  const [volumeB, setVolumeB] = useState(0.9)
  const [eqLowB, setEqLowB] = useState(0)
  const [eqMidB, setEqMidB] = useState(0)
  const [eqHighB, setEqHighB] = useState(0)

  // 1. Initialize AudioContext and Master Nodes
  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // Create nodes
    const masterGain = ctx.createGain()
    const crossfaderGainA = ctx.createGain()
    const crossfaderGainB = ctx.createGain()

    // Route: Crossfaders -> Master Gain -> Destination
    crossfaderGainA.connect(masterGain)
    crossfaderGainB.connect(masterGain)
    masterGain.connect(ctx.destination)

    // Store references
    masterGainRef.current = masterGain
    crossfaderGainARef.current = crossfaderGainA
    crossfaderGainBRef.current = crossfaderGainB

    // Set initial volumes
    masterGain.gain.value = masterVolume

    // Set initial crossfader gains
    updateCrossfaderGains(0.0, crossfaderGainA, crossfaderGainB)

    setAudioContext(ctx)

    return () => {
      ctx.close()
    }
  }, [])

  // Calculate and update crossfader volumes based on linear crossfade curve
  const updateCrossfaderGains = (
    val: number,
    nodeA = crossfaderGainARef.current,
    nodeB = crossfaderGainBRef.current
  ) => {
    if (!nodeA || !nodeB) return

    // Linear Crossfader Curve
    // If val is negative (towards A), Deck A is 100% and B fades out.
    // If val is positive (towards B), Deck B is 100% and A fades out.
    const gainA = val > 0 ? 1.0 - val : 1.0
    const gainB = val < 0 ? 1.0 + val : 1.0

    nodeA.gain.value = gainA
    nodeB.gain.value = gainB
  }

  // Handle Mixer Controls changes
  const handleMasterVolumeChange = (val: number) => {
    setMasterVolume(val)
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = val
    }
  }

  const handleCrossfaderChange = (val: number) => {
    setCrossfader(val)
    updateCrossfaderGains(val)
  }

  const handleEqChange = (deck: 'A' | 'B', eqType: 'low' | 'mid' | 'high', val: number) => {
    if (deck === 'A') {
      if (eqType === 'low') setEqLowA(val)
      if (eqType === 'mid') setEqMidA(val)
      if (eqType === 'high') setEqHighA(val)
    } else {
      if (eqType === 'low') setEqLowB(val)
      if (eqType === 'mid') setEqMidB(val)
      if (eqType === 'high') setEqHighB(val)
    }
  }

  const handleVolumeChange = (deck: 'A' | 'B', val: number) => {
    if (deck === 'A') {
      setVolumeA(val)
    } else {
      setVolumeB(val)
    }
  }

  return (
    <div className="flex items-center justify-center gap-6 p-6">
      {/* DECK A */}
      <Deck
        deckId="A"
        track={trackA}
        audioContext={audioContext}
        masterGain={masterGainRef.current}
        crossfaderGainA={crossfaderGainARef.current}
        crossfaderGainB={crossfaderGainBRef.current}
        onUpdateBpm={(bpm) => trackA && onUpdateBpm(trackA.id, bpm)}
        opponentBpm={trackB && trackB.bpm > 0 ? trackB.bpm : null}
        eqLowVal={eqLowA}
        eqMidVal={eqMidA}
        eqHighVal={eqHighA}
        volumeVal={volumeA}
        onLoadTrack={(t) => onLoadTrack(t, 'A')}
      />

      {/* CENTER MIXER */}
      <Mixer
        eqLowA={eqLowA}
        eqMidA={eqMidA}
        eqHighA={eqHighA}
        volumeA={volumeA}
        eqLowB={eqLowB}
        eqMidB={eqMidB}
        eqHighB={eqHighB}
        volumeB={volumeB}
        crossfader={crossfader}
        masterVolume={masterVolume}
        onEqChange={handleEqChange}
        onVolumeChange={handleVolumeChange}
        onCrossfaderChange={handleCrossfaderChange}
        onMasterVolumeChange={handleMasterVolumeChange}
      />

      {/* DECK B */}
      <Deck
        deckId="B"
        track={trackB}
        audioContext={audioContext}
        masterGain={masterGainRef.current}
        crossfaderGainA={crossfaderGainARef.current}
        crossfaderGainB={crossfaderGainBRef.current}
        onUpdateBpm={(bpm) => trackB && onUpdateBpm(trackB.id, bpm)}
        opponentBpm={trackA && trackA.bpm > 0 ? trackA.bpm : null}
        eqLowVal={eqLowB}
        eqMidVal={eqMidB}
        eqHighVal={eqHighB}
        volumeVal={volumeB}
        onLoadTrack={(t) => onLoadTrack(t, 'B')}
      />
    </div>
  )
}
