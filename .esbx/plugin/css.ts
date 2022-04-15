import type {Plugin} from 'esbuild'
import fs from 'fs-extra'
import path from 'path'

export const cssPlugin: Plugin = {
  name: 'css',
  setup(build) {
    const {
      outfile,
      outdir = path.dirname(outfile!),
      absWorkingDir = process.cwd()
    } = build.initialOptions
    const outputDir = path.isAbsolute(outdir)
      ? outdir
      : path.join(absWorkingDir, outdir)
    build.initialOptions.metafile = true
    build.onEnd(async res => {
      const meta = res.metafile!
      const files = Object.entries(meta.outputs).filter(entry =>
        entry[0].endsWith('.css')
      )
      if (files.length === 0) return
      const contents = Buffer.concat(
        await Promise.all(
          files.map(entry => {
            return fs.readFile(path.join(absWorkingDir, entry[0]))
          })
        )
      )
      await fs.writeFile(path.join(outputDir, 'index.css'), contents)
    })
  }
}
