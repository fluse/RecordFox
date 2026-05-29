import React, { useRef, useState } from 'react'

interface KnobProps {
  label: string
  min: number
  max: number
  value: number
  onChange: (val: number) => void
  color?: string // Active accent color (e.g. #a855f7)
  defaultValue?: number
}

export default function Knob({
  label,
  min,
  max,
  value,
  onChange,
  color = '#a855f7',
  defaultValue = 0
}: KnobProps): React.JSX.Element {
  const knobRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Double click resets to default value
  const handleDoubleClick = () => {
    onChange(defaultValue)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const startY = e.clientY
    const startValue = value
    const range = max - min
    const pixelsPerUnit = 150 / range // 150px drag sweeps full range

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY // drag up increases value
      const newValue = startValue + deltaY / pixelsPerUnit
      const clampedValue = Math.max(min, Math.min(max, newValue))
      onChange(Math.round(clampedValue))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Calculate rotation angle and percentage using a piecewise linear mapping
  // to ensure 0 dB is pointing straight up (12 o'clock, 0 degrees)
  let angle = 0
  let percent = 0.5

  if (value <= 0) {
    percent = min !== 0 ? 0.5 * (1 - value / min) : 0
    angle = min !== 0 ? (value / min) * -135 : 0
  } else {
    percent = max !== 0 ? 0.5 + 0.5 * (value / max) : 1
    angle = max !== 0 ? (value / max) * 135 : 0
  }

  return (
    <div className="flex flex-col items-center select-none">
      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
        {label}
      </span>

      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className={`relative h-10 w-10 cursor-ns-resize rounded-full border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 flex items-center justify-center shadow-inner transition-colors duration-150 ${
          isDragging ? 'border-zinc-700 bg-zinc-900' : ''
        }`}
        style={{
          boxShadow: isDragging
            ? `0 0 8px ${color}22, inset 0 2px 4px rgba(0,0,0,0.5)`
            : 'inset 0 2px 4px rgba(0,0,0,0.5)'
        }}
      >
        {/* SVG Circular Indicator */}
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40">
          {/* Background track circle */}
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="#27272a" // zinc-800
            strokeWidth="2.5"
            strokeDasharray="75.4 100.5" // 3/4 circle
            strokeDashoffset="-12.5"
            strokeLinecap="round"
          />
          {/* Foreground active level circle */}
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray={`${percent * 75.4} 100.5`}
            strokeDashoffset="-12.5"
            strokeLinecap="round"
            style={{ transition: isDragging ? 'none' : 'stroke-dasharray 0.15s ease' }}
          />
        </svg>

        {/* Knob Inner Circle / Cap */}
        <div
          className="h-7 w-7 rounded-full bg-zinc-900 border border-zinc-950 flex items-center justify-center relative shadow"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {/* Knob pointer marker line */}
          <div
            className="absolute top-0.5 left-1/2 -translate-x-1/2 w-0.5 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      <span className="text-[9px] font-mono mt-1 font-semibold text-zinc-400">
        {value > 0 ? `+${value}` : value} dB
      </span>
    </div>
  )
}
