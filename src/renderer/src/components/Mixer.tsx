import React from 'react'

import Knob from './Knob'

interface MixerProps {
  eqLowA: number
  eqMidA: number
  eqHighA: number
  volumeA: number

  eqLowB: number
  eqMidB: number
  eqHighB: number
  volumeB: number

  crossfader: number // -1.0 (Left, Deck A) to 1.0 (Right, Deck B)
  masterVolume: number

  onEqChange: (deck: 'A' | 'B', eqType: 'low' | 'mid' | 'high', val: number) => void
  onVolumeChange: (deck: 'A' | 'B', val: number) => void
  onCrossfaderChange: (val: number) => void
  onMasterVolumeChange: (val: number) => void
}

export default function Mixer({
  eqLowA,
  eqMidA,
  eqHighA,
  volumeA,
  eqLowB,
  eqMidB,
  eqHighB,
  volumeB,
  crossfader,
  masterVolume,
  onEqChange,
  onVolumeChange,
  onCrossfaderChange,
  onMasterVolumeChange
}: MixerProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-between border border-zinc-900 bg-zinc-950 px-4 py-4 rounded-xl shadow-lg w-[260px] select-none">
      {/* EQ Knobs Area */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 w-full py-2">
        {/* DECK A EQ */}
        <div className="flex flex-col items-center gap-3 border-r border-zinc-900/60 pr-2">
          <Knob
            label="HI"
            min={-24}
            max={12}
            value={eqHighA}
            onChange={(val) => onEqChange('A', 'high', val)}
            color="#a855f7"
          />
          <Knob
            label="MID"
            min={-24}
            max={12}
            value={eqMidA}
            onChange={(val) => onEqChange('A', 'mid', val)}
            color="#a855f7"
          />
          <Knob
            label="LOW"
            min={-24}
            max={12}
            value={eqLowA}
            onChange={(val) => onEqChange('A', 'low', val)}
            color="#a855f7"
          />
        </div>

        {/* DECK B EQ */}
        <div className="flex flex-col items-center gap-3 pl-2">
          <Knob
            label="HI"
            min={-24}
            max={12}
            value={eqHighB}
            onChange={(val) => onEqChange('B', 'high', val)}
            color="#9333ea"
          />
          <Knob
            label="MID"
            min={-24}
            max={12}
            value={eqMidB}
            onChange={(val) => onEqChange('B', 'mid', val)}
            color="#9333ea"
          />
          <Knob
            label="LOW"
            min={-24}
            max={12}
            value={eqLowB}
            onChange={(val) => onEqChange('B', 'low', val)}
            color="#9333ea"
          />
        </div>
      </div>

      {/* Channel Faders (Volume) */}
      <div className="flex items-center justify-center gap-10 py-1 w-full flex-1">
        {/* Volume Fader A */}
        <div className="flex flex-col items-center relative h-[90px] justify-between">
          <span className="text-[9px] text-zinc-500 font-bold">VOL A</span>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.05"
            value={volumeA}
            onChange={(e) => onVolumeChange('A', parseFloat(e.target.value))}
            className="accent-primary h-1.5 w-14 cursor-pointer bg-zinc-900 rounded-lg outline-none rotate-270"
          />
          <span className="text-[9px] font-mono text-zinc-500">{Math.round(volumeA * 100)}%</span>
        </div>

        {/* Master Volume */}
        <div className="flex flex-col items-center relative h-[90px] justify-between border-x border-zinc-900 px-3">
          <span className="text-[9px] text-amber-500 font-bold">MASTER</span>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.05"
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            className="accent-amber-500 h-1.5 w-14 cursor-pointer bg-zinc-900 rounded-lg outline-none rotate-270"
          />
          <span className="text-[9px] font-mono text-zinc-500">
            {Math.round(masterVolume * 100)}%
          </span>
        </div>

        {/* Volume Fader B */}
        <div className="flex flex-col items-center relative h-[90px] justify-between">
          <span className="text-[9px] text-zinc-500 font-bold">VOL B</span>
          <input
            type="range"
            min="0"
            max="1.0"
            step="0.05"
            value={volumeB}
            onChange={(e) => onVolumeChange('B', parseFloat(e.target.value))}
            className="accent-purple-600 h-1.5 w-14 cursor-pointer bg-zinc-900 rounded-lg outline-none rotate-270"
          />
          <span className="text-[9px] font-mono text-zinc-500">{Math.round(volumeB * 100)}%</span>
        </div>
      </div>

      {/* Crossfader */}
      <div className="flex flex-col items-center w-full pt-4 pb-2 border-t border-zinc-900/60 mt-1">
        <div className="flex justify-between w-full text-[8px] font-bold text-zinc-600 px-4">
          <span>A</span>
          <span>CENTER</span>
          <span>B</span>
        </div>
        <input
          type="range"
          min="-1.0"
          max="1.0"
          step="0.05"
          value={crossfader}
          onChange={(e) => onCrossfaderChange(parseFloat(e.target.value))}
          className="accent-zinc-400 h-2 w-full cursor-pointer bg-zinc-900 rounded-lg outline-none mt-1"
        />
      </div>
    </div>
  )
}
