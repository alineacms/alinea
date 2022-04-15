import type {Plugin} from 'esbuild'
import fs from 'fs-extra'
import glob from 'glob'

export const distPlugin: Plugin = {
  name: 'dist',
  setup(build) {
    build.initialOptions.metafile = true
    build.onEnd(res => {
      if (res.errors.length > 0) return
      const packages = glob.sync('dist/**/*/src')
      for (const pkg of packages) {
        const dist = pkg.replace('dist/', 'packages/').replace('/src', '/dist')
        fs.copySync(pkg, dist)
      }
      fs.copySync('dist/index.css', 'packages/css/src/generated.css')
    })
  }
}
