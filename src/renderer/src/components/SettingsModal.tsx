import React, { useState } from 'react'
import { X, Folder, FolderOpen, Sun, Moon, Loader2 } from 'lucide-react'
import type { AppSettings } from '@main/db'
import { useLanguage, type Language } from '../i18n'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  onUpdateSettings: (settings: Partial<AppSettings>) => Promise<void>
  onMigrate: (newPath: string, moveFiles: boolean) => Promise<void>
  isSyncing: boolean
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onMigrate,
  isSyncing
}: SettingsModalProps): React.JSX.Element | null {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { t } = useLanguage()

  if (!isOpen) return null

  const handleSelectFolder = async (): Promise<void> => {
    setError('')
    try {
      const selectedPath = await window.api.selectDirectory()
      if (!selectedPath || selectedPath === settings.downloadPath) return

      // Prompt for migration choice
      const choice = await window.api.confirmMigration()
      if (choice === 'cancel') return

      setLoading(true)

      const moveFiles = choice === 'move'
      await onMigrate(selectedPath, moveFiles)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || t('settings.errorChangePath'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleTheme = async (theme: 'dark' | 'light'): Promise<void> => {
    if (theme === settings.theme) return
    try {
      await onUpdateSettings({ theme })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || t('settings.errorChangeTheme'))
    }
  }

  const handleUpdateWorkers = async (maxWorkers: number): Promise<void> => {
    if (maxWorkers === settings.maxWorkers) return
    try {
      await onUpdateSettings({ maxWorkers })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || t('settings.errorChangeWorkers'))
    }
  }

  const handleUpdateLanguage = async (language: Language): Promise<void> => {
    if (language === settings.language) return
    try {
      await onUpdateSettings({ language })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || t('settings.errorChangeLanguage'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-xl font-bold text-zinc-100 border-b border-zinc-900 pb-3">
          {t('settings.title')}
        </h2>

        <div className="space-y-6">
          {/* Theme Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-400">
              {t('settings.theme')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleToggleTheme('dark')}
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold border transition ${
                  settings.theme === 'dark'
                    ? 'bg-primary border-primary text-white shadow shadow-primary/20'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Moon className="h-4 w-4" />
                {t('settings.themeDark')}
              </button>
              <button
                type="button"
                onClick={() => handleToggleTheme('light')}
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold border transition ${
                  settings.theme === 'light'
                    ? 'bg-amber-600 border-amber-600 text-white shadow shadow-amber-600/20'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                <Sun className="h-4 w-4" />
                {t('settings.themeLight')}
              </button>
            </div>
          </div>

          {/* Language Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-400">
              {t('settings.languageLabel')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { code: 'de', name: 'Deutsch' },
                  { code: 'en', name: 'English' },
                  { code: 'fr', name: 'Français' },
                  { code: 'es', name: 'Español' }
                ] as const
              ).map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleUpdateLanguage(lang.code)}
                  disabled={loading}
                  title={lang.name}
                  className={`flex items-center justify-center rounded-lg py-2 text-xs font-bold border transition cursor-pointer ${
                    (settings.language || 'de') === lang.code
                      ? settings.theme === 'light'
                        ? 'bg-amber-600 border-amber-600 text-white shadow shadow-amber-600/20'
                        : 'bg-primary border-primary text-white shadow shadow-primary/20'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {lang.code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Download Path */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-400">
              {t('settings.downloadPathLabel')}
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={settings.downloadPath}
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300 outline-none truncate"
                  title={settings.downloadPath}
                />
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={loading || isSyncing}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:opacity-50 cursor-pointer"
                  title={
                    isSyncing
                      ? t('settings.downloadPathSyncingTooltip')
                      : t('settings.downloadPathSelectTooltip')
                  }
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Folder className="h-4 w-4 text-zinc-400" />
                  )}
                  {t('settings.downloadPathSelect')}
                </button>
                <button
                  type="button"
                  onClick={() => window.api.openPath(settings.downloadPath)}
                  disabled={loading || !settings.downloadPath}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:opacity-50 cursor-pointer"
                  title={t('settings.downloadPathOpenTooltip')}
                >
                  <FolderOpen className="h-4 w-4 text-zinc-400" />
                  {t('settings.downloadPathOpen')}
                </button>
              </div>
              {isSyncing ? (
                <p className="text-[10px] text-amber-500 font-semibold bg-amber-500/10 border border-amber-500/20 rounded p-1.5 mt-0.5 animate-pulse">
                  {t('settings.downloadPathSyncingWarning')}
                </p>
              ) : (
                <p className="text-[10px] text-zinc-500">{t('settings.downloadPathHelp')}</p>
              )}
            </div>
          </div>

          {/* Concurrent Downloads / Workers Selector */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-zinc-400">
                {t('settings.concurrentDownloads')}
              </label>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded border ${
                  settings.theme === 'light'
                    ? 'text-amber-600 bg-amber-600/10 border-amber-600/20'
                    : 'text-primary bg-primary/10 border-primary/20'
                }`}
              >
                {t('settings.workersCount', { count: settings.maxWorkers || 3 })}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={settings.maxWorkers || 3}
                onChange={(e) => handleUpdateWorkers(parseInt(e.target.value))}
                disabled={loading}
                className={`flex-1 h-2 cursor-pointer bg-zinc-900 rounded-lg outline-none border border-zinc-800 ${
                  settings.theme === 'light' ? 'accent-amber-600' : 'accent-primary'
                }`}
              />
            </div>
            <p className="mt-2 text-[10px] text-zinc-500">
              {t('settings.concurrentDownloadsHelp')}
            </p>
          </div>

          {error && (
            <p className="text-xs font-medium text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2">
              {error}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:opacity-50 cursor-pointer"
            >
              {t('settings.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
