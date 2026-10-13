import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
import {defaultClientConditions, defineConfig, type Plugin} from 'vite'

const shim = (file: string) =>
  fileURLToPath(new URL(`./shims/${file}`, import.meta.url))

const srcDir = fileURLToPath(new URL('../../src/', import.meta.url))

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

/** Serve the lab: `bun lab`, then open http://localhost:4700 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [
    // Fast refresh needs a window: only the page's own components get it
    react({include: /test\/lab\/(main|ui\/.*)\.tsx$/}),
    skipAlineaStyles()
  ],
  resolve: {
    conditions: ['alinea-src', ...defaultClientConditions],
    alias: [
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
  css: {modules: {generateScopedName: 'lab-[local]'}},
  worker: {format: 'es'},
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
})
