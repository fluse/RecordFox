import React from 'react'
import type { Track } from '@main/db'
import { formatDuration } from '@renderer/utils/audio'
import { useLanguage } from '@renderer/i18n'

interface DeckHeaderProps {
  deckId: 'A' | 'B'
  track: Track | null
  currentBpm: number
  pitch: number
  duration: number
  timeRemainingRef: React.RefObject<HTMLSpanElement | null>
}

export const DeckHeader: React.FC<DeckHeaderProps> = ({
  deckId,
  track,
  currentBpm,
  pitch,
  duration,
  timeRemainingRef
}) => {
  const { t } = useLanguage()

  return (
    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
      <div className="truncate max-w-[240px]">
        <div className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          DECK {deckId}
        </div>
        <div className="text-sm font-bold text-zinc-200 truncate">
          {track ? track.title : t('deck.noTrackLoaded')}
        </div>
        <div className="text-xs text-zinc-500 truncate">{track ? track.artist : '---'}</div>
      </div>

      {/* BPM & Time */}
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
          <span ref={timeRemainingRef}>{track ? formatDuration(duration) : '0:00'}</span>
          <span className="text-[9px] font-semibold text-zinc-600 ml-1 uppercase">Rem</span>
        </div>
      </div>
    </div>
  )
}

export default DeckHeader
