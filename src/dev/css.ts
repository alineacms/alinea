import type {Plugin} from 'esbuild'
import fs from 'node:fs'

export const cssPlugin: Plugin = {
  name: 'css',
  setup(build) {
    build.initialOptions.metafile = true
    build.onEnd(async res => {
      if (res.errors.length > 0) return
      const meta = res.metafile!
      const files = Object.entries(meta.outputs).filter(([file]) => {
        return file.endsWith('.css')
      })
      const contents =
        fs.readFileSync('src/global.css', 'utf-8') +
        files
          .map(([file]) => {
            return fs.readFileSync(file, 'utf-8')
          })
          .join('\n')
      fs.writeFileSync('dist/index.css', contents)
    })
  }
}
