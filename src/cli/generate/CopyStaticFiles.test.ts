import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {expect, test} from 'bun:test'
import {copyStaticFiles} from './CopyStaticFiles.js'

test('writes the generated ESM package and empty runtime index', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'alinea-generated-'))
  const bundleDir = path.join(outDir, 'node_modules/@alinea/generated')
  try {
    await copyStaticFiles({
      cmd: 'build',
      wasmCache: false,
      rootDir: outDir,
      configLocation: path.join(outDir, 'cms.ts'),
      configDir: outDir,
      staticDir: outDir,
      quiet: true,
      bundleDir,
      fix: false
    })

    expect(await exists(path.join(bundleDir, 'runtime-index.js'))).toBe(true)
    expect(await exists(path.join(bundleDir, 'package.json'))).toBe(true)
    const packageJson = JSON.parse(
      await fs.readFile(path.join(bundleDir, 'package.json'), 'utf8')
    )
    expect(packageJson).toMatchObject({
      name: '@alinea/generated',
      type: 'module',
      exports: {
        './server-config.js': './server-config.js'
      }
    })
  } finally {
    await fs.rm(outDir, {recursive: true, force: true})
  }
})

async function exists(location: string): Promise<boolean> {
  return fs.access(location).then(
    () => true,
    () => false
  )
}
