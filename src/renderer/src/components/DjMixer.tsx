import React, { useEffect } from 'react'
import Deck from './Deck'
import Mixer from './Mixer'
import type { Track } from '@main/db'
import { useMixerStore } from '@renderer/store/useMixerStore'

interface DjMixerProps {
  trackA: Track | null
  trackB: Track | null
  onLoadTrack: (track: Track, deck: 'A' | 'B') => void
}

export default function DjMixer({ trackA, trackB, onLoadTrack }: DjMixerProps): React.JSX.Element {
  // 1. Initialize AudioContext and Master Nodes
  useEffect(() => {
    const ctx = new (
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    )()

    // Create nodes
    const masterGainNode = ctx.createGain()
    const crossfaderGainANode = ctx.createGain()
    const crossfaderGainBNode = ctx.createGain()

    // Route: Crossfaders -> Master Gain -> Destination
    crossfaderGainANode.connect(masterGainNode)
    crossfaderGainBNode.connect(masterGainNode)
    masterGainNode.connect(ctx.destination)

    // Set initial volumes
    const { masterVolume, crossfader, setAudioNodes } = useMixerStore.getState()
    masterGainNode.gain.value = masterVolume

    // Set initial crossfader gains based on the equal-power crossfade curve
    const x = (crossfader + 1.0) / 2.0
    const gainA = Math.cos((x * Math.PI) / 2)
    const gainB = Math.sin((x * Math.PI) / 2)
    crossfaderGainANode.gain.value = gainA
    crossfaderGainBNode.gain.value = gainB

    setAudioNodes(ctx, masterGainNode, crossfaderGainANode, crossfaderGainBNode)

    return () => {
      ctx.close()
      useMixerStore.getState().clearAudioNodes()
    }
  }, [])

  return (
    <div className="flex items-center justify-center gap-6 p-6">
      {/* DECK A */}
      <Deck
        deckId="A"
        track={trackA}
        opponentBpm={trackB && trackB.bpm > 0 ? trackB.bpm : null}
        onLoadTrack={(t) => onLoadTrack(t, 'A')}
      />

      {/* CENTER MIXER */}
      <Mixer />

      {/* DECK B */}
      <Deck
        deckId="B"
        track={trackB}
        opponentBpm={trackA && trackA.bpm > 0 ? trackA.bpm : null}
        onLoadTrack={(t) => onLoadTrack(t, 'B')}
      />
    </div>
  )
}
