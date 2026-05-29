import { useState, useEffect } from 'react'
import logoSvg from '../assets/logo-recordfox.svg'

interface SplashScreenProps {
  onDone: () => void
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    // Phase: fade in (600ms) → hold → fade out start
    const holdTimer = setTimeout(() => setPhase('out'), 2000)
    const doneTimer = setTimeout(() => onDone(), 2700)
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        transition: 'opacity 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: phase === 'out' ? 0 : 1,
        pointerEvents: phase === 'out' ? 'none' : 'all',
      }}
    >
      {/* Radial glow behind logo */}
      <div
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(109,40,217,0.22) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'rfSplashGlow 2.4s ease-in-out infinite alternate',
        }}
      />

      {/* Logo */}
      <div
        style={{
          position: 'relative',
          animation: 'rfSplashIn 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        <img
          src={logoSvg}
          alt="RecordFox"
          style={{
            width: 180,
            height: 180,
            filter: 'invert(1) sepia(1) saturate(3) hue-rotate(240deg) brightness(1.15)',
          }}
        />
      </div>

      {/* App name */}
      <div
        style={{
          marginTop: 28,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: '#e2d9f3',
          fontFamily: '"Inter", "Segoe UI", sans-serif',
          textTransform: 'uppercase',
          animation: 'rfSplashIn 0.75s 0.15s cubic-bezier(0.34, 1.2, 0.64, 1) both',
        }}
      >
        RecordFox
      </div>

      {/* Subtle tagline */}
      <div
        style={{
          marginTop: 8,
          fontSize: 13,
          color: 'rgba(167,139,250,0.6)',
          letterSpacing: '0.2em',
          fontFamily: '"Inter", "Segoe UI", sans-serif',
          textTransform: 'uppercase',
          animation: 'rfSplashIn 0.75s 0.3s cubic-bezier(0.34, 1.2, 0.64, 1) both',
        }}
      >
        Your DJ Sync Station
      </div>

      <style>{`
        @keyframes rfSplashIn {
          from { opacity: 0; transform: scale(0.82) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes rfSplashGlow {
          from { transform: scale(0.9); opacity: 0.6; }
          to   { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
