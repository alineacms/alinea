import fs from 'node:fs'
import path from 'node:path'
import {isRecord} from '#/core/util/Objects.js'
import {onExit} from 'signal-exit'

/** The running `alinea dev` of a project, read by `alinea mcp` */
export interface DevLock {
  url: string
  pid: number
}

/** The lock lives in the project's generated directory, next to its database */
export function devLockFile(outDir: string): string {
  return path.join(outDir, 'dev.json')
}

/** Record the dev server and remove the record again when it exits */
export function writeDevLock(file: string, lock: DevLock): void {
  fs.writeFileSync(file, JSON.stringify(lock))
  onExit(() => {
    // A later dev server of the same project may have taken over the file
    if (readDevLock(file)?.pid === lock.pid) fs.rmSync(file, {force: true})
  })
}

/** The dev server in the lock file, if its process still runs */
export function readDevLock(file: string): DevLock | undefined {
  let lock: unknown
  try {
    lock = JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return undefined
  }
  if (!isRecord(lock)) return undefined
  const {url, pid} = lock
  if (typeof url !== 'string' || typeof pid !== 'number') return undefined
  return isRunning(pid) ? {url, pid} : undefined
}

function isRunning(pid: number) {
  try {
    return process.kill(pid, 0)
  } catch (error) {
    // The process exists but belongs to another user
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
