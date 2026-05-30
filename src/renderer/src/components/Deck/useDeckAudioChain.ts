import { useEffect, useRef, useState } from 'react'
import { useMixerStore } from '@renderer/store/useMixerStore'

export function useDeckAudioChain(deckId: 'A' | 'B'): BiquadFilterNode | null {
  const audioContext = useMixerStore((state) => state.audioContext)
  const masterGain = useMixerStore((state) => state.masterGain)
  const crossfaderGainA = useMixerStore((state) => state.crossfaderGainA)
  const crossfaderGainB = useMixerStore((state) => state.crossfaderGainB)

  const eqLowVal = useMixerStore((state) => (deckId === 'A' ? state.eqLowA : state.eqLowB))
  const eqMidVal = useMixerStore((state) => (deckId === 'A' ? state.eqMidA : state.eqMidB))
  const eqHighVal = useMixerStore((state) => (deckId === 'A' ? state.eqHighA : state.eqHighB))
  const volumeVal = useMixerStore((state) => (deckId === 'A' ? state.volumeA : state.volumeB))

  const filterLowRef = useRef<BiquadFilterNode | null>(null)
  const filterMidRef = useRef<BiquadFilterNode | null>(null)
  const filterHighRef = useRef<BiquadFilterNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  const [filterLowNode, setFilterLowNode] = useState<BiquadFilterNode | null>(null)

  useEffect(() => {
    if (!audioContext || !masterGain || !crossfaderGainA || !crossfaderGainB) return

    // Create nodes
    const low = audioContext.createBiquadFilter()
    const mid = audioContext.createBiquadFilter()
    const high = audioContext.createBiquadFilter()
    const gain = audioContext.createGain()

    // Configure EQ filters
    low.type = 'lowshelf'
    low.frequency.value = 250

    mid.type = 'peaking'
    mid.frequency.value = 1000
    mid.Q.value = 1.0

    high.type = 'highshelf'
    high.frequency.value = 4000

    // Connect chain: low → mid → high → gain → crossfader → master
    low.connect(mid).connect(high).connect(gain)
    const targetCrossfader = deckId === 'A' ? crossfaderGainA : crossfaderGainB
    gain.connect(targetCrossfader)

    // Set initial values
    gain.gain.value = volumeVal
    low.gain.setValueAtTime(eqLowVal, audioContext.currentTime)
    mid.gain.setValueAtTime(eqMidVal, audioContext.currentTime)
    high.gain.setValueAtTime(eqHighVal, audioContext.currentTime)

    filterLowRef.current = low
    filterMidRef.current = mid
    filterHighRef.current = high
    gainNodeRef.current = gain

    // Expose entry node to the audio engine hook
    Promise.resolve().then(() => setFilterLowNode(low))

    return () => {
      try {
        low.disconnect()
        mid.disconnect()
        high.disconnect()
        gain.disconnect()
      } catch {
        /* safe to ignore */
      }
      filterLowRef.current = null
      filterMidRef.current = null
      filterHighRef.current = null
      gainNodeRef.current = null
      Promise.resolve().then(() => setFilterLowNode(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioContext, masterGain, crossfaderGainA, crossfaderGainB, deckId])

  // Sync EQ / Volume on changes
  useEffect(() => {
    if (gainNodeRef.current && audioContext) {
      const now = audioContext.currentTime
      gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now)
      gainNodeRef.current.gain.linearRampToValueAtTime(volumeVal, now + 0.02)
    }
  }, [volumeVal, audioContext])

  useEffect(() => {
    if (filterLowRef.current && audioContext) {
      const now = audioContext.currentTime
      filterLowRef.current.gain.setValueAtTime(filterLowRef.current.gain.value, now)
      filterLowRef.current.gain.linearRampToValueAtTime(eqLowVal, now + 0.02)
    }
  }, [eqLowVal, audioContext])

  useEffect(() => {
    if (filterMidRef.current && audioContext) {
      const now = audioContext.currentTime
      filterMidRef.current.gain.setValueAtTime(filterMidRef.current.gain.value, now)
      filterMidRef.current.gain.linearRampToValueAtTime(eqMidVal, now + 0.02)
    }
  }, [eqMidVal, audioContext])

  useEffect(() => {
    if (filterHighRef.current && audioContext) {
      const now = audioContext.currentTime
      filterHighRef.current.gain.setValueAtTime(filterHighRef.current.gain.value, now)
      filterHighRef.current.gain.linearRampToValueAtTime(eqHighVal, now + 0.02)
    }
  }, [eqHighVal, audioContext])

  return filterLowNode
}
