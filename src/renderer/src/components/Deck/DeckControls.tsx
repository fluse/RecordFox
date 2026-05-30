import React from 'react'
import { Play, Pause } from 'lucide-react'
import { useLanguage } from '@renderer/i18n'
import type { Track } from '@main/db'

interface DeckControlsProps {
  track: Track | null
  filterLowNode: BiquadFilterNode | null
  opponentBpm: number | null
  isPlaying: boolean
  activeLoopBeats: number | null
  togglePlay: () => void
  handleCueMouseDown: () => void
  handleCueMouseUp: () => void
  setCuePoint: () => void
  handleSync: () => void
  handleBeatLoop: (beats: number) => void
}

export const DeckControls: React.FC<DeckControlsProps> = ({
  track,
  filterLowNode,
  opponentBpm,
  isPlaying,
  activeLoopBeats,
  togglePlay,
  handleCueMouseDown,
  handleCueMouseUp,
  setCuePoint,
  handleSync,
  handleBeatLoop
}) => {
  const { t } = useLanguage()

  return (
    <div className="space-y-3">
      {/* Play / Cue row */}
      <div className="flex gap-2">
        <button
          onClick={togglePlay}
          disabled={!track || !filterLowNode}
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
          onMouseDown={handleCueMouseDown}
          onMouseUp={handleCueMouseUp}
          disabled={!track || !filterLowNode}
          className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white font-bold py-2.5 text-center transition disabled:opacity-30 select-none"
        >
          CUE
        </button>
      </div>

      {/* Set Cue / Sync row */}
      <div className="flex gap-2">
        <button
          onClick={setCuePoint}
          disabled={!track || !filterLowNode}
          title={t('deck.setCueTooltip')}
          className="flex-1 text-center py-1.5 rounded bg-zinc-900 text-xs font-semibold text-zinc-400 border border-zinc-900 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
        >
          Set Cue
        </button>
        <button
          onClick={handleSync}
          disabled={!track || !opponentBpm || opponentBpm === 0 || !filterLowNode}
          className="flex-1 text-center py-1.5 rounded bg-amber-600/10 hover:bg-amber-600/20 text-xs font-bold text-amber-500 border border-amber-600/30 transition disabled:opacity-30"
        >
          SYNC
        </button>
      </div>

      {/* Beat Loop buttons */}
      <div className="space-y-1.5 border-t border-zinc-900/60 pt-2.5">
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          {t('deck.autoloop')}
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 4, 8].map((beats) => (
            <button
              key={beats}
              onClick={() => handleBeatLoop(beats)}
              disabled={!track || !track.bpm || !filterLowNode}
              className={`flex-1 text-xs font-bold py-1.5 rounded transition ${
                activeLoopBeats === beats
                  ? 'bg-primary text-white font-black'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-900 hover:bg-zinc-800 hover:text-zinc-200'
              } disabled:opacity-30`}
            >
              {beats}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DeckControls
