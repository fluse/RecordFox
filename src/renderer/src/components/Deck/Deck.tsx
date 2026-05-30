import React, { useRef, useState } from 'react'
import type { Track } from '@main/db'
import { useDeckEngine } from '@renderer/hooks/useDeckEngine'
import { useMixerStore } from '@renderer/store/useMixerStore'
import { useDeckAudioChain } from './useDeckAudioChain'
import { DeckHeader } from './DeckHeader'
import { WaveformCanvas } from './WaveformCanvas'
import { DeckControls } from './DeckControls'
import { PitchController } from './PitchController'

// ── Props ────────────────────────────────────────────────────────────────────

interface DeckProps {
  deckId: 'A' | 'B'
  track: Track | null
  opponentBpm: number | null
  onLoadTrack: (track: Track) => void
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Deck({
  deckId,
  track,
  opponentBpm,
  onLoadTrack
}: DeckProps): React.JSX.Element {
  const audioContext = useMixerStore((state) => state.audioContext)

  // Permanent EQ/Gain Audio Node chain setup
  const filterLowNode = useDeckAudioChain(deckId)

  // Audio Engine Hook integration
  const engine = useDeckEngine({
    deckId,
    track,
    audioContext,
    filterLowNode,
    opponentBpm
  })

  // Ref to directly manipulate remaining duration display without React state changes
  const timeRemainingValueRef = useRef<HTMLSpanElement | null>(null)

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault()
    const allowed = e.dataTransfer.effectAllowed
    e.dataTransfer.dropEffect =
      allowed === 'move' || allowed === 'copyMove' || allowed === 'all' ? 'move' : 'copy'
    setIsDragOver(true)
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setIsDragOver(false)
    try {
      const dataStr = e.dataTransfer.getData('text/plain')
      if (dataStr) onLoadTrack(JSON.parse(dataStr) as Track)
    } catch (err) {
      console.error('Failed to parse dropped track:', err)
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const currentBpm = track && track.bpm > 0 ? Math.round(track.bpm * engine.pitch) : 0

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col border p-4 rounded-xl shadow-lg relative select-none w-[420px] transition-all duration-200 ${
        isDragOver
          ? deckId === 'A'
            ? 'border-primary ring-2 ring-primary/20 bg-primary/5 scale-[1.01]'
            : 'border-purple-600 ring-2 ring-purple-600/20 bg-purple-600/5 scale-[1.01]'
          : 'border-zinc-900 bg-zinc-950'
      } ${deckId === 'A' ? 'border-l-primary/30' : 'border-r-primary/30'}`}
    >
      {/* Deck Header */}
      <DeckHeader
        deckId={deckId}
        track={track}
        currentBpm={currentBpm}
        pitch={engine.pitch}
        duration={engine.duration}
        timeRemainingRef={timeRemainingValueRef}
      />

      {/* Waveform Canvas */}
      <WaveformCanvas
        deckId={deckId}
        track={track}
        peaks={engine.peaks}
        duration={engine.duration}
        decoding={engine.decoding}
        loopStart={engine.loopStart}
        loopEnd={engine.loopEnd}
        cueTime={engine.cueTime}
        getCurrentTime={engine.getCurrentTime}
        seek={engine.seek}
        timeRemainingRef={timeRemainingValueRef}
      />

      {/* Controls Grid */}
      <div className="grid grid-cols-12 gap-3 pt-2">
        {/* LEFT: Play, Cue, Sync, Loop */}
        <div className="col-span-8 space-y-3">
          <DeckControls
            track={track}
            filterLowNode={filterLowNode}
            opponentBpm={opponentBpm}
            isPlaying={engine.isPlaying}
            activeLoopBeats={engine.activeLoopBeats}
            togglePlay={engine.togglePlay}
            handleCueMouseDown={engine.handleCueMouseDown}
            handleCueMouseUp={engine.handleCueMouseUp}
            setCuePoint={engine.setCuePoint}
            handleSync={engine.handleSync}
            handleBeatLoop={engine.handleBeatLoop}
          />
        </div>

        {/* RIGHT: Pitch slider & Key Lock */}
        <PitchController
          track={track}
          filterLowNode={filterLowNode}
          pitch={engine.pitch}
          keyLock={engine.keyLock}
          keyShift={engine.keyShift}
          handlePitchChange={engine.handlePitchChange}
          toggleKeyLock={engine.toggleKeyLock}
          handleKeyShiftChange={engine.handleKeyShiftChange}
          startNudge={engine.startNudge}
          stopNudge={engine.stopNudge}
        />
      </div>
    </div>
  )
}
