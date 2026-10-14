import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
import {defaultClientConditions, defineConfig, type Plugin} from 'vite'

const shim = (file: string) =>
  fileURLToPath(new URL(`./shims/${file}`, import.meta.url))

const srcDir = fileURLToPath(new URL('../../src/', import.meta.url))
const webDir = fileURLToPath(new URL('../../apps/web/', import.meta.url))

/**
 * The lab renders none of Alinea's components, but its modules import their
 * styles: workers cannot inject them, so they load as class name maps.
 */
function skipAlineaStyles(): Plugin {
  const prefix = '\0lab-style:'
  return {
    name: 'lab-skip-alinea-styles',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!/\.(css|scss)$/.test(source) || !importer?.startsWith(srcDir)) return
      return prefix + source
    },
    load(id) {
      if (!id.startsWith(prefix)) return
      return 'export default new Proxy({}, {get: (_, key) => typeof key === "string" ? key : undefined})'
    }
  }
}

const labDir = fileURLToPath(new URL('.', import.meta.url))

/**
 * The repository declares no side effects, which would let a build drop the
 * lab modules imported for theirs: the routes they register on the lab
 * network and the environment they set up for a realm.
 */
function keepLabSideEffects(): Plugin {
  return {
    name: 'lab-keep-side-effects',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer?.startsWith(labDir)) return
      const resolved = await this.resolve(source, importer, {
        ...options,
        skipSelf: true
      })
      if (!resolved?.id.startsWith(labDir)) return resolved
      return {...resolved, moduleSideEffects: true}
    }
  }
}

/**
 * `bun lab` serves the lab page of the website on http://localhost:4700,
 * without the rest of the website. `bun lab:build` builds the engine the
 * website loads into `apps/web/public/lab`.
 */
export default defineConfig(({command}) => ({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/lab/',
  plugins: [
    // Fast refresh needs a window: only the page's components get it
    react({include: /(test\/lab\/main|apps\/web\/src\/.*)\.tsx$/}),
    skipAlineaStyles(),
    keepLabSideEffects()
  ],
  resolve: {
    conditions: ['alinea-src', ...defaultClientConditions],
    alias: [
      {find: /^@\//, replacement: `${webDir}src/`},
      {find: /^next\/cache(\.js)?$/, replacement: shim('next-cache.ts')},
      {find: /^next\/headers(\.js)?$/, replacement: shim('next-headers.ts')},
      {
        find: /^next\/constants(\.js)?$/,
        replacement: shim('next-constants.ts')
      },
      {find: /^next\/dynamic(\.js)?$/, replacement: shim('next-dynamic.ts')},
      {find: /^@alinea\/generated\/.*$/, replacement: shim('generated.ts')}
    ]
  },
  css: {modules: {generateScopedName: '[name]__[local]'}},
  // Every realm sets its own environment, see shared/realm.ts: a build must
  // read it at runtime instead of inlining an empty one
  define: command === 'build' ? {'process.env': 'globalThis.process.env'} : {},
  worker: {format: 'es'},
  build: {
    outDir: `${webDir}public/lab`,
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./engine.ts', import.meta.url)),
      // The website imports the engine by name and calls its exports
      preserveEntrySignatures: 'exports-only',
      output: {entryFileNames: 'engine.js'}
    }
  },
  server: {port: 4700, host: '127.0.0.1', fs: {allow: ['../..']}},
  optimizeDeps: {
    // Workers discover these late, which would reload the page mid-run
    include: [
      '@alinea/iso',
      '@badgateway/oauth2-client',
      'cito',
      'comlink',
      'cookie-es',
      'microcbor',
      'p-lazy',
      'p-limit',
      'rado',
      'rado/driver',
      'rado/driver/d1',
      'rado/driver/libsql',
      'rado/driver/sql.js',
      'rado/universal/columns',
      'regexparam'
    ],
    exclude: ['@alinea/sqlite-wasm']
  }
}))
