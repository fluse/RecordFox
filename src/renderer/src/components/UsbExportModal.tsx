import React, { useState, useEffect, useCallback } from 'react'
import { HardDrive, X, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { useLanguage } from '../i18n'

interface UsbDrive {
  name: string
  path: string
}

interface UsbExportModalProps {
  isOpen: boolean
  onClose: () => void
  playlistId: string
  playlistTitle: string
}

export default function UsbExportModal({
  isOpen,
  onClose,
  playlistId,
  playlistTitle
}: UsbExportModalProps): React.JSX.Element | null {
  const [step, setStep] = useState<
    'scanning' | 'select' | 'confirm_overwrite' | 'exporting' | 'success' | 'error'
  >('scanning')
  const [drives, setDrives] = useState<UsbDrive[]>([])
  const [selectedDrive, setSelectedDrive] = useState<UsbDrive | null>(null)
  const [progress, setProgress] = useState<{
    current: number
    total: number
    trackTitle: string
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const { t } = useLanguage()

  const scanDrives = useCallback(async (): Promise<void> => {
    setStep('scanning')
    setErrorMessage('')
    try {
      const detected = await window.api.getUsbDrives()
      setDrives(detected)
      if (detected.length === 0) {
        setSelectedDrive(null)
      } else {
        setSelectedDrive(detected[0])
      }
      setStep('select')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(msg || t('usbExport.errorScanDrives'))
      setStep('error')
    }
  }, [t])

  useEffect((): void => {
    if (isOpen) {
      setTimeout((): void => {
        scanDrives()
      }, 0)
    }
  }, [isOpen, scanDrives])

  useEffect((): (() => void) | undefined => {
    if (step === 'exporting') {
      const unsubscribe = window.api.onExportProgress((data) => {
        if (data.playlistId === playlistId) {
          setProgress({
            current: data.current,
            total: data.total,
            trackTitle: data.trackTitle
          })
        }
      })
      return (): void => {
        unsubscribe()
      }
    }
    return undefined
  }, [step, playlistId])

  if (!isOpen) return null

  const handleExport = async (forceOverwrite = false): Promise<void> => {
    if (!selectedDrive) return
    setStep('exporting')
    setProgress(null)
    setErrorMessage('')

    try {
      const res = await window.api.exportPlaylist(playlistId, selectedDrive.path, forceOverwrite)
      if (res.success) {
        setStep('success')
      } else if (res.exists) {
        setStep('confirm_overwrite')
      } else {
        setErrorMessage(res.error || t('usbExport.failedError'))
        setStep('error')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(msg || t('usbExport.failedError'))
      setStep('error')
    }
  }

  const handleClose = (): void => {
    setStep('scanning')
    setDrives([])
    setSelectedDrive(null)
    setProgress(null)
    setErrorMessage('')
    onClose()
  }

  const percent = progress ? Math.floor((progress.current / progress.total) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        {step !== 'exporting' && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">{t('usbExport.title')}</h2>
            <p className="text-xs text-zinc-500 truncate max-w-[280px]">
              {t('usbExport.playlistLabel', { title: playlistTitle })}
            </p>
          </div>
        </div>

        {step === 'scanning' && (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-zinc-400">{t('usbExport.scanning')}</p>
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-4">
            {drives.length === 0 ? (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-center">
                <AlertCircle className="mx-auto h-7 w-7 text-yellow-500 mb-2" />
                <p className="text-sm font-medium text-zinc-200">
                  {t('usbExport.noStickDetectedTitle')}
                </p>
                <p className="text-xs text-zinc-500 mt-1">{t('usbExport.noStickDetectedDesc')}</p>
              </div>
            ) : (
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {drives.length === 1
                    ? t('usbExport.singleDriveLabel')
                    : t('usbExport.multiDriveLabel')}
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {drives.map((drive) => (
                    <button
                      key={drive.path}
                      type="button"
                      onClick={(): void => setSelectedDrive(drive)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition cursor-pointer ${
                        selectedDrive?.path === drive.path
                          ? 'border-primary bg-primary/10 text-zinc-100 shadow-[0_0_12px_rgba(var(--primary),0.1)]'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <HardDrive
                        className={`h-5 w-5 ${
                          selectedDrive?.path === drive.path ? 'text-primary' : 'text-zinc-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold">{drive.name}</p>
                        <p className="text-xs text-zinc-500 font-mono truncate">{drive.path}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                {t('usbExport.cancel')}
              </button>
              {drives.length === 0 ? (
                <button
                  type="button"
                  onClick={(): Promise<void> => scanDrives()}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('usbExport.scanAgain')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(): Promise<void> => handleExport(false)}
                  disabled={!selectedDrive}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg shadow-primary/20 cursor-pointer"
                >
                  {t('usbExport.exportBtn')}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'confirm_overwrite' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
              <AlertCircle className="mx-auto h-7 w-7 text-amber-500 mb-2" />
              <p className="text-sm font-medium text-zinc-200">
                {t('usbExport.playlistExistsTitle')}
              </p>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                {t('usbExport.playlistExistsDesc', {
                  title: playlistTitle,
                  driveName: selectedDrive ? selectedDrive.name : ''
                })}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={(): void => setStep('select')}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                {t('usbExport.cancel')}
              </button>
              <button
                type="button"
                onClick={(): Promise<void> => handleExport(true)}
                className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {t('usbExport.overwriteConfirm')}
              </button>
            </div>
          </div>
        )}

        {step === 'exporting' && (
          <div className="py-6 space-y-4">
            <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>{t('usbExport.exporting')}</span>
              </div>
              <span className="font-mono font-bold text-zinc-300">
                {progress ? `${progress.current}/${progress.total}` : t('usbExport.preparing')}
              </span>
            </div>

            <div className="space-y-2">
              <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden border border-zinc-800/50">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="truncate text-center text-xs font-medium text-zinc-500">
                {progress ? progress.trackTitle : t('usbExport.initializing')}
              </p>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-100">{t('usbExport.successTitle')}</p>
              <p className="text-xs text-zinc-500 mt-1.5 max-w-[280px] leading-relaxed">
                {t('usbExport.successDesc', {
                  driveName: selectedDrive ? selectedDrive.name : ''
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 w-full rounded-lg bg-zinc-900 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              {t('usbExport.doneBtn')}
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
              <AlertCircle className="mx-auto h-7 w-7 text-red-500 mb-2" />
              <p className="text-sm font-medium text-zinc-200">{t('usbExport.failedTitle')}</p>
              <p className="text-xs text-red-400 mt-2 bg-red-500/10 p-2.5 rounded border border-red-500/20 text-left font-mono break-all max-h-24 overflow-y-auto">
                {errorMessage}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                {t('usbExport.closeBtn')}
              </button>
              <button
                type="button"
                onClick={(): Promise<void> => scanDrives()}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors shadow-lg cursor-pointer"
              >
                {t('usbExport.tryAgainBtn')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
