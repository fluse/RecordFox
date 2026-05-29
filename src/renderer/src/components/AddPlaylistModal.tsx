import React, { useState } from 'react'
import { Plus, Loader2, X } from 'lucide-react'

interface AddPlaylistModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (url: string) => Promise<void>
}

export default function AddPlaylistModal({ isOpen, onClose, onAdd }: AddPlaylistModalProps): React.JSX.Element | null {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    // Simple YouTube playlist validation
    if (!url.includes('list=')) {
      setError('Bitte gib eine gültige YouTube-Playlist-URL ein (muss "list=" enthalten).')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onAdd(url.trim())
      setUrl('')
      onClose()
    } catch (e: any) {
      setError(e.message || 'Fehler beim Hinzufügen der Playlist.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-4 text-xl font-bold text-zinc-100">YouTube Playlist hinzufügen</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-400">
              Playlist URL
            </label>
            <input
              type="text"
              placeholder="https://www.youtube.com/playlist?list=..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError('')
              }}
              disabled={loading}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none ring-primary/50 transition focus:border-primary focus:ring-2"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird geladen...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Hinzufügen
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
