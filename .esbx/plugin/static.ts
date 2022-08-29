import type {Plugin} from 'esbuild'
import fs from 'fs'
import path from 'path'
import {copyDir} from '../copy'

export const staticPlugin: Plugin = {
  name: '@esbx/static',
  setup(build) {
    const dir = 'static'
    const {
      entryPoints,
      outdir,
      outfile,
      absWorkingDir = process.cwd()
    } = build.initialOptions
    if (!entryPoints) return
    const locations = new Set(
      (Array.isArray(entryPoints)
        ? entryPoints
        : Object.values(entryPoints)
      ).map(path.dirname)
    )
    const makeAbs = (p: string) =>
      path.isAbsolute(p) ? p : path.join(absWorkingDir, p)
    const outputDir = outdir || (outfile && path.dirname(outfile))
    if (!outputDir) throw new Error('StaticPlugin requires outfile or outdir')
    let trigger: Promise<any>
    build.onStart(() => {
      const tasks: Array<Promise<void>> = []
      for (const location of locations) {
        const source = path.join(makeAbs(location), dir)
        const output = source.replace(
          'packages' + path.sep,
          'dist/out' + path.sep
        )
        if (fs.existsSync(source)) {
          if (!fs.existsSync(output)) fs.mkdirSync(output, {recursive: true})
          const task = copyDir(source, output)
          tasks.push(task)
        }
      }
      trigger = Promise.all(tasks)
    })
    build.onEnd(() => trigger)
  }
}
