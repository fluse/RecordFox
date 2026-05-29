import { exec } from 'child_process'
import { readdirSync, statSync, existsSync } from 'fs'
import { join, basename } from 'path'

export interface UsbDrive {
  name: string
  path: string
}

/**
 * Detects connected USB/removable drives across macOS, Windows, and Linux.
 * Does not require external C++ modules.
 */
export async function detectUsbDrives(): Promise<UsbDrive[]> {
  const platform = process.platform
  const drives: UsbDrive[] = []

  if (platform === 'darwin') {
    try {
      const volumesDir = '/Volumes'
      if (existsSync(volumesDir)) {
        const files = readdirSync(volumesDir)
        for (const file of files) {
          const fullPath = join(volumesDir, file)
          try {
            const stats = statSync(fullPath)
            if (stats.isDirectory()) {
              // Run diskutil info to verify if it is an external/removable volume (not a Disk Image)
              const isRemovable = await new Promise<boolean>((resolve) => {
                exec(`diskutil info "${fullPath}"`, (error, stdout) => {
                  if (error) {
                    resolve(false)
                    return
                  }
                  const lines = stdout.split('\n')
                  let external = false
                  let removable = false
                  let isDiskImage = false

                  for (const line of lines) {
                    const colonIdx = line.indexOf(':')
                    if (colonIdx !== -1) {
                      const key = line.substring(0, colonIdx).trim()
                      const val = line.substring(colonIdx + 1).trim()
                      if (key === 'Device Location' && val === 'External') {
                        external = true
                      }
                      if (key === 'Removable Media' && (val === 'Removable' || val === 'Yes')) {
                        removable = true
                      }
                      if (key === 'Protocol' && val === 'Disk Image') {
                        isDiskImage = true
                      }
                    }
                  }
                  resolve((external || removable) && !isDiskImage)
                })
              })

              if (isRemovable) {
                drives.push({
                  name: file,
                  path: fullPath
                })
              }
            }
          } catch {
            // Ignore stats errors (e.g. broken symlinks like Macintosh HD -> /)
          }
        }
      }
    } catch (err) {
      console.error('Error scanning macOS volumes:', err)
    }
  } else if (platform === 'win32') {
    try {
      // First try WMIC (standard on most Windows versions)
      const wmicOutput = await new Promise<string>((resolve) => {
        exec('wmic logicaldisk where drivetype=2 get deviceid, volumename', (error, stdout) => {
          if (error) {
            resolve('')
            return
          }
          resolve(stdout)
        })
      })

      if (wmicOutput && wmicOutput.trim()) {
        const lines = wmicOutput
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
        // Skip header line (e.g. "DeviceID  VolumeName")
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/\s{2,}/) // split by 2 or more spaces
          if (parts.length > 0) {
            const driveId = parts[0] // e.g. "E:"
            if (driveId && driveId.includes(':')) {
              const label = parts[1] || 'Wechseldatenträger'
              drives.push({
                name: `${label} (${driveId})`,
                path: driveId + '\\'
              })
            }
          }
        }
      } else {
        // Fallback to PowerShell
        const psOutput = await new Promise<string>((resolve) => {
          exec(
            `powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Volume | Where-Object { $_.DriveType -eq 'Removable' } | ForEach-Object { $_.DriveLetter + '|' + $_.FileSystemLabel }"`,
            (error, stdout) => {
              if (error) {
                resolve('')
                return
              }
              resolve(stdout)
            }
          )
        })

        if (psOutput && psOutput.trim()) {
          const lines = psOutput
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
          for (const line of lines) {
            const parts = line.split('|')
            const letter = parts[0]
            if (letter && letter.length === 1) {
              const label = parts[1] || 'Wechseldatenträger'
              drives.push({
                name: `${label} (${letter}:)`,
                path: `${letter}:\\`
              })
            }
          }
        } else {
          // Ultimate fallback: check D:\ to Z:\ using Node fs.existsSync
          for (let char = 68; char <= 90; char++) {
            const letter = String.fromCharCode(char) + ':'
            const drivePath = letter + '\\'
            try {
              if (existsSync(drivePath)) {
                drives.push({
                  name: `Wechseldatenträger (${letter})`,
                  path: drivePath
                })
              }
            } catch {
              // Ignore drive read errors
            }
          }
        }
      }
    } catch (err) {
      console.error('Error scanning Windows drives:', err)
    }
  } else if (platform === 'linux') {
    try {
      // First try lsblk (standard on modern Linux)
      const lsblkOutput = await new Promise<string>((resolve) => {
        exec('lsblk -o MOUNTPOINT,RM,NAME -p -r', (error, stdout) => {
          if (error) {
            resolve('')
            return
          }
          resolve(stdout)
        })
      })

      if (lsblkOutput && lsblkOutput.trim()) {
        const lines = lsblkOutput
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
        // Skip header (MOUNTPOINT RM NAME)
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(' ')
          if (parts.length >= 2) {
            const mountpoint = parts[0]
            const rm = parts[1] // "1" means removable
            if (rm === '1' && mountpoint && mountpoint !== '/' && mountpoint !== '[SWAP]') {
              drives.push({
                name: basename(mountpoint) || mountpoint,
                path: mountpoint
              })
            }
          }
        }
      }

      // Fallback: search /media and /run/media directory structures
      if (drives.length === 0) {
        const mediaDirs = ['/media', '/run/media']
        for (const base of mediaDirs) {
          if (existsSync(base)) {
            const users = readdirSync(base)
            for (const user of users) {
              const userPath = join(base, user)
              try {
                if (statSync(userPath).isDirectory()) {
                  const mounts = readdirSync(userPath)
                  for (const mount of mounts) {
                    const mountPath = join(userPath, mount)
                    if (statSync(mountPath).isDirectory()) {
                      drives.push({
                        name: mount,
                        path: mountPath
                      })
                    }
                  }
                }
              } catch {
                // Ignore directories that cannot be read
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error scanning Linux drives:', err)
    }
  }

  return drives
}
