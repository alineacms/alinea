import {expect, test} from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {compileConfig} from './CompileConfig.js'
import {copyStaticFiles} from './CopyStaticFiles.js'

test('compiles the server config inside the generated ESM package', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'alinea-config-'))
  const bundleDir = path.join(rootDir, 'node_modules/@alinea/generated')
  const configLocation = path.join(rootDir, 'cms.ts')
  await fs.writeFile(configLocation, 'export const cms = {marker: true}')
  const context = {
    cmd: 'build' as const,
    wasmCache: false,
    rootDir,
    configLocation,
    configDir: rootDir,
    staticDir: rootDir,
    quiet: true,
    bundleDir,
    fix: false
  }
  try {
    await copyStaticFiles(context)
    const builds = compileConfig(context)
    const result = await builds.next()
    await builds.return()

    expect(result.done).toBe(false)
    expect(result.value).toMatchObject({marker: true})
    expect(await exists(path.join(bundleDir, 'server-config.js'))).toBe(true)
    expect(await exists(path.join(bundleDir, 'config.js'))).toBe(false)
  } finally {
    await fs.rm(rootDir, {recursive: true, force: true})
  }
})

async function exists(location: string): Promise<boolean> {
  return fs.access(location).then(
    () => true,
    () => false
  )
}
