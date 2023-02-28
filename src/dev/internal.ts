import {getManifest} from '@esbx/workspaces'
import type {Plugin} from 'esbuild'
import glob from 'glob'
import fs from 'node:fs'
import path from 'node:path'

const BROWSER_TARGET = 'browser'
const SERVER_TARGET = 'server'

export const internalPlugin: Plugin = {
  name: 'internal',
  setup(build) {
    const cwd = process.cwd()
    const src = path.join(cwd, 'src')
    const browserFiles = new Set<string>()
    const serverFiles = new Set<string>()
    build.onStart(() => {
      for (const file of glob.sync(`src/**/*.${BROWSER_TARGET}.tsx`)) {
        browserFiles.add(
          file.slice('src/'.length, -`.${BROWSER_TARGET}.tsx`.length)
        )
      }
      for (const file of glob.sync(`src/**/*.${BROWSER_TARGET}.ts`)) {
        browserFiles.add(
          file.slice('src/'.length, -`.${BROWSER_TARGET}.ts`.length)
        )
      }
      for (const file of glob.sync(`src/**/*.${SERVER_TARGET}.ts`)) {
        serverFiles.add(
          file.slice('src/'.length, -`.${SERVER_TARGET}.ts`.length)
        )
      }
    })
    build.onResolve({filter: /^alinea\/.*/}, args => {
      if (args.path === 'alinea/css') return {path: args.path, external: true}
      const requested = args.path.slice('alinea/'.length)
      if (browserFiles.has(requested) || serverFiles.has(requested))
        return {path: args.path, external: true}
      const relative = path
        .relative(args.resolveDir, path.join(src, requested + '.js'))
        .replaceAll('\\', '/')
      return {path: './' + relative, external: true}
    })
    build.onEnd(async () => {
      const pkg = getManifest('.')
      const exports: Record<string, any> = {
        '.': './index.js',
        './css': './index.css',
        './*.cjs': './*.cjs',
        './*': './*.js'
      }
      for (const file of browserFiles) {
        exports[`./${file}`] = {
          worker: `./${file}.js`,
          browser: `./${file}.${BROWSER_TARGET}.js`,
          default: `./${file}.js`
        }
      }
      for (const file of serverFiles) {
        exports[`./${file}`] = {
          browser: `./${file}.js`,
          default: `./${file}.${SERVER_TARGET}.js`
        }
      }
      fs.writeFileSync(
        'dist/package.json',
        JSON.stringify({type: 'module', name: 'alinea', exports}, null, 2)
      )
    })
  }
}

/*
if (args.path === 'alinea/css') return {path: args.path, external: true}
const requested = args.path.slice('alinea/'.length)
return build
  .resolve(`./src/${requested}`, {
    importer: args.importer,
    kind: args.kind,
    resolveDir: process.cwd()
  })
  .then(result => {
    return {...result, external: true}
  })*/
