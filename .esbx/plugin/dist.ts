import type {Plugin} from 'esbuild'
import fs from 'fs'
import path from 'path'

export const distPlugin: Plugin = {
  name: 'dist',
  setup(build) {
    build.initialOptions.metafile = true
    function withExtension(
      file: string,
      oldExtension: string,
      newExtension: string
    ) {
      return file.slice(0, -oldExtension.length) + newExtension
    }
    build.onEnd(async res => {
      const meta = res.metafile!
      const keep = ['.d.ts', '.js.map']
      for (const file of Object.keys(meta.outputs)) {
        if (file.endsWith('.js')) {
          const destination = file
            .replace('dist/', 'packages/')
            .replace('src/', 'dist/')
          const location = path.dirname(destination)
          if (!fs.existsSync(location))
            fs.mkdirSync(location, {recursive: true})
          fs.copyFileSync(file, destination)
          for (const extension of keep) {
            const source = withExtension(file, '.js', extension)
            if (fs.existsSync(source))
              fs.copyFileSync(
                source,
                withExtension(destination, '.js', extension)
              )
          }
        }
      }
    })
  }
}
