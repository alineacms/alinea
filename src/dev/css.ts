import type {Plugin} from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import {sassPlugin} from './sass.js'

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
      const input =
        `import './src/global.scss'\n` +
        files
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
          outfile: 'dist/index.js',
          stdin: {contents: input, resolveDir: absWorkingDir},
          plugins: [sassPlugin],
          write: false,
          bundle: true,
          absWorkingDir,
          loader: {
            '.woff2': 'file'
          }
        })
        .then(res => {
          for (const output of res.outputFiles) {
            if (output.path.endsWith('.js')) continue
            fs.writeFileSync(output.path, output.contents)
          }
        })
    })
  }
}
