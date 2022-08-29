import type {Plugin} from 'esbuild'
import {promises as fs} from 'fs'
import glob from 'glob'
import {copyDir} from '../copy'

export const distPlugin: Plugin = {
  name: 'dist',
  setup(build) {
    build.initialOptions.metafile = true
    build.onEnd(async res => {
      if (res.errors.length > 0) return
      const packages = glob.sync('dist/out/**/*/src')
      for (const pkg of packages) {
        const dist = pkg
          .replace('dist/out/', 'packages/')
          .replace('/src', '/dist')
        await copyDir(pkg, dist)
        await copyDir(pkg.replace('/out/', '/types/'), dist)
      }
      await fs.copyFile('dist/out/index.css', 'packages/css/src/generated.css')
    })
  }
}
