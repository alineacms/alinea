import type {Plugin} from 'esbuild'
import {promises as fs} from 'fs'
import glob from 'glob'
import path from 'path'
import {copyDir} from '../copy'

export const distPlugin: Plugin = {
  name: 'dist',
  setup(build) {
    build.initialOptions.metafile = true
    build.onEnd(async res => {
      if (res.errors.length > 0) return
      const packages = glob.sync('dist/**/*/src')
      for (const pkg of packages) {
        const dist = pkg.replace('dist/', 'packages/').replace('/src', '/dist')
        await copyDir(pkg, dist)
      }
      await fs.copyFile('dist/index.css', 'packages/css/src/generated.css')
    })
  }
}
