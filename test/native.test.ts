import {expect, test} from 'bun:test'
import {build} from 'esbuild'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'

// Deployments read the generated database through the native overlay
// extension, which only loads under Node: run those checks there.
const scripts = ['overlay.node.ts']
const outDir = join(import.meta.dir, '../node_modules/.cache/alinea-native')

for (const script of scripts)
  test(`native: ${script}`, async () => {
    await mkdir(outDir, {recursive: true})
    const outfile = join(outDir, script.replace(/\.ts$/, '.mjs'))
    await build({
      entryPoints: [join(import.meta.dir, 'native', script)],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      conditions: ['alinea-src'],
      // Packages load from node_modules, next to the bundle.
      packages: 'external',
      logLevel: 'error'
    })
    const run = Bun.spawnSync(['node', outfile], {stderr: 'pipe'})
    const output = run.stderr.toString().replace(/^.*ExperimentalWarning.*\n?/gm, '')
    expect(output).not.toMatch(/Error/)
    expect(run.exitCode).toBe(0)
  }, 30_000)
