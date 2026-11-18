import fs from 'node:fs'
import path from 'node:path'

/** The directory holding `.git`, at or above `dir` */
export function workTreeOf(dir: string): string | undefined {
  let current = dir
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current
    const parent = path.dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}
