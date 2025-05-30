import fs from 'node:fs'
import path from 'node:path'
import glob from 'glob'

const CSS_ENTRY = 'alinea/css'

export default {
  name: CSS_ENTRY,
  setup(build) {
    build.onResolve({filter: new RegExp(`^${CSS_ENTRY}$`)}, args => {
      return {
        path: args.path,
        namespace: CSS_ENTRY
      }
    })
    build.onLoad(
      {filter: new RegExp(`^${CSS_ENTRY}$`), namespace: CSS_ENTRY},
      args => {
        const files = glob.sync('src/**/*.scss')
        const entryPoint = [`@import url('./src/global.css');`]
          .concat(files.map(file => `@import url('./${file}');`))
          .join('\n')
        return {
          contents: entryPoint,
          loader: 'css',
          watchFiles: files,
          watchDirs: dirsOf('src'),
          resolveDir: '.'
        }
      }
    )
  }
}

function dirsOf(source: string) {
  const contents = fs.readdirSync(source, {withFileTypes: true})
  return contents
    .filter(dirent => dirent.isDirectory())
    .flatMap((dirent): Array<string> => {
      const wd = path.join(source, dirent.name)
      return [wd, ...dirsOf(wd)]
    })
}
