import { create } from 'zustand'

export interface MixerState {
  audioContext: AudioContext | null
  masterGain: GainNode | null
  crossfaderGainA: GainNode | null
  crossfaderGainB: GainNode | null

  // Mixer parameters
  masterVolume: number
  crossfader: number // -1.0 (Left, Deck A) to 1.0 (Right, Deck B)

  // Deck A parameters
  volumeA: number
  eqLowA: number
  eqMidA: number
  eqHighA: number

  // Deck B parameters
  volumeB: number
  eqLowB: number
  eqMidB: number
  eqHighB: number

  // Actions
  setAudioNodes: (
    ctx: AudioContext,
    masterGain: GainNode,
    crossfaderGainA: GainNode,
    crossfaderGainB: GainNode
  ) => void
  clearAudioNodes: () => void
  setMasterVolume: (val: number) => void
  setCrossfader: (val: number) => void
  setEq: (deck: 'A' | 'B', eqType: 'low' | 'mid' | 'high', val: number) => void
  setVolume: (deck: 'A' | 'B', val: number) => void
}

export const useMixerStore = create<MixerState>((set, get) => ({
  audioContext: null,
  masterGain: null,
  crossfaderGainA: null,
  crossfaderGainB: null,

  masterVolume: 0.8,
  crossfader: 0.0,

  volumeA: 0.9,
  eqLowA: 0,
  eqMidA: 0,
  eqHighA: 0,

  volumeB: 0.9,
  eqLowB: 0,
  eqMidB: 0,
  eqHighB: 0,

  setAudioNodes: (ctx, masterGain, crossfaderGainA, crossfaderGainB) => {
    set({
      audioContext: ctx,
      masterGain,
      crossfaderGainA,
      crossfaderGainB
    })
  },

  clearAudioNodes: () => {
    set({
      audioContext: null,
      masterGain: null,
      crossfaderGainA: null,
      crossfaderGainB: null
    })
  },

  setMasterVolume: (val) => {
    set({ masterVolume: val })
    const { masterGain, audioContext } = get()
    if (!masterGain) return

    if (audioContext) {
      const now = audioContext.currentTime
      masterGain.gain.setValueAtTime(masterGain.gain.value, now)
      masterGain.gain.linearRampToValueAtTime(val, now + 0.02)
    } else {
      masterGain.gain.setValueAtTime(val, 0)
    }
  },

  setCrossfader: (val) => {
    set({ crossfader: val })
    const { crossfaderGainA, crossfaderGainB, audioContext } = get()
    if (!crossfaderGainA || !crossfaderGainB) return

    // Equal-Power Crossfader Curve (constant power sum of squares = 1)
    // val ranges from -1.0 (Deck A) to +1.0 (Deck B)
    const x = (val + 1.0) / 2.0
    const gainA = Math.cos((x * Math.PI) / 2)
    const gainB = Math.sin((x * Math.PI) / 2)

    if (audioContext) {
      const now = audioContext.currentTime
      crossfaderGainA.gain.setValueAtTime(crossfaderGainA.gain.value, now)
      crossfaderGainA.gain.linearRampToValueAtTime(gainA, now + 0.02)
      crossfaderGainB.gain.setValueAtTime(crossfaderGainB.gain.value, now)
      crossfaderGainB.gain.linearRampToValueAtTime(gainB, now + 0.02)
    } else {
      crossfaderGainA.gain.setValueAtTime(gainA, 0)
      crossfaderGainB.gain.setValueAtTime(gainB, 0)
    }
  },

  setEq: (deck, eqType, val) => {
    if (deck === 'A') {
      if (eqType === 'low') set({ eqLowA: val })
      if (eqType === 'mid') set({ eqMidA: val })
      if (eqType === 'high') set({ eqHighA: val })
    } else {
      if (eqType === 'low') set({ eqLowB: val })
      if (eqType === 'mid') set({ eqMidB: val })
      if (eqType === 'high') set({ eqHighB: val })
    }
  },

  setVolume: (deck, val) => {
    if (deck === 'A') {
      set({ volumeA: val })
    } else {
      set({ volumeB: val })
    }
  }
}))
