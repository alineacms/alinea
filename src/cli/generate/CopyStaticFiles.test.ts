import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {copyStaticFiles} from './CopyStaticFiles.js'

test('writes private generated artifacts without creating a package', async () => {
  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'alinea-generated-'))
  try {
    await copyStaticFiles(
      {
        cmd: 'build',
        wasmCache: false,
        rootDir: outDir,
        configLocation: path.join(outDir, 'cms.ts'),
        configDir: outDir,
        staticDir: outDir,
        quiet: true,
        outDir,
        fix: false
      },
      {releaseId: 'release-id', configId: 'config-id'}
    )

    const settings = JSON.parse(
      await fs.readFile(path.join(outDir, 'release-meta.json'), 'utf8')
    )
    expect(settings.releaseId).toBe('release-id')
    expect(settings.configId).toBe('config-id')
    expect(await exists(path.join(outDir, 'source.json'))).toBe(true)
    expect(await exists(path.join(outDir, 'source.js'))).toBe(false)
    expect(await exists(path.join(outDir, 'package.json'))).toBe(false)
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
