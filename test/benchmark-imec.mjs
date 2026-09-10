import {build} from 'esbuild'
import {mkdir} from 'node:fs/promises'
import path from 'node:path'
import {existsSync} from 'node:fs'

// Read-only against the project. Generated bundles/results live in an explicit
// scratch directory. Use the actual installed package, including its patches.
const [project, scratch, syncRoot] = process.argv.slice(2)
if (!project || !scratch || !syncRoot)
  throw new Error(
    'Usage: bun test/benchmark-imec.mjs PROJECT SCRATCH SYNC_ARCHIVE'
  )
const repo = process.cwd()
await mkdir(scratch, {recursive: true})
const installed = path.join(project, 'node_modules/alinea/dist')
const plugins = [
  {
    name: 'benchmark-config',
    setup(api) {
      api.onResolve({filter: /^alinea\/next$/}, () => ({
        path: 'cms',
        namespace: 'bench'
      }))
      api.onLoad({filter: /.*/, namespace: 'bench'}, () => ({
        contents: `import {createConfig} from ${JSON.stringify(installed + '/core/Config.js')}; export function createCMS(config) { return {config: createConfig(config)} }`,
        resolveDir: project
      }))
      api.onResolve({filter: /\.(css|scss)$/}, () => ({
        path: 'style',
        namespace: 'empty'
      }))
      api.onLoad({filter: /.*/, namespace: 'empty'}, () => ({
        contents: 'export default {}'
      }))
    }
  }
]
await build({
  entryPoints: [project + '/src/cms.tsx'],
  outfile: scratch + '/config.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  plugins,
  nodePaths: [project + '/node_modules']
})
for (const engine of ['installed', 'sqlite', 'wasm', 'sync']) {
  const root = engine === 'sync' ? syncRoot : repo
  const bridge =
    engine === 'installed'
      ? `export {EntryIndex} from '${installed}/core/db/EntryIndex.js'; export {EntryResolver} from '${installed}/core/db/EntryResolver.js'; export {FSSource} from '${installed}/core/source/FSSource.js'; export {WriteableTree} from '${installed}/core/source/Tree.js';`
      : engine === 'sync'
        ? `export {exportRuntimeDatabase} from '#/database/runtime/Exporter.js'; export {RuntimeEntryStore} from '#/database/runtime/Store.js'; export {MemoryRangeSource} from '#/database/replica/Bundle.js'; export {DatabaseResolver} from '#/database/query/Resolver.js'; export {FSSource} from '#/core/source/FSSource.js';`
        : `export {EntryRuntime} from '#/database/runtime/EntryRuntime.js'; export {EntryIndexTable, EntryDataTable, entryIndexRow, entrySource} from '#/database/entry/Schema.js'; export {compileEntryQuery} from '#/database/query/EntryQuery.js'; export {wasmDatabase} from '#/database/driver/WasmDatabase.js'; export {connect} from 'rado/driver/bun-sqlite';`
  await build({
    stdin: {contents: bridge, resolveDir: root},
    outfile: scratch + '/' + engine + '.mjs',
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    nodePaths: [repo + '/node_modules'],
    plugins: [
      {
        name: 'source',
        setup(api) {
          api.onResolve({filter: /^#\//}, args => {
            const target = path
              .join(root, 'src', args.path.slice(2))
              .replace(/\.js$/, '.ts')
            return {path: existsSync(target) ? target : target + 'x'}
          })
          api.onResolve(
            {
              filter:
                /^(rado|cito|microcbor|minisearch|p-limit|p-debounce|@alinea\/iso|@alinea\/sqlite-wasm)(\/|$)/
            },
            args => ({
              path: import.meta.resolve(args.path).replace('file://', ''),
              external: true
            })
          )
        }
      }
    ]
  })
}
console.log(JSON.stringify({scratch, installed, syncRoot}))
