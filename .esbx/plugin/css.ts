import type {Plugin} from 'esbuild'
import fs from 'fs'
import path from 'path'
import {sassPlugin} from './sass'

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
      if (res.errors.length > 0) return
      const meta = res.metafile!
      const files = Object.keys(meta.inputs).filter(file => {
        return file.endsWith('.scss')
      })
      const input = files
        .filter(file => !file.startsWith('@esbx'))
        .map(file => {
          const loc = path
            .relative(absWorkingDir, file)
            .split(path.sep)
            .join('/')
          return `import './${loc}'`
        })
        .join('\n')
      return build.esbuild
        .build({
          ignoreAnnotations: true,
          outdir: 'dist/out',
          stdin: {contents: input, resolveDir: absWorkingDir},
          plugins: [sassPlugin],
          write: false,
          bundle: true,
          absWorkingDir,
          sourcemap: 'inline'
        })
        .then(res => {
          const css = res.outputFiles.find(file => file.path.endsWith('.css'))!
          fs.writeFileSync(path.join(outputDir, 'index.css'), css.contents)
        })
    })
  }
}
