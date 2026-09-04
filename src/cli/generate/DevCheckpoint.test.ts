import {expect, test} from 'bun:test'
import type {RuntimeDatabaseIndex} from '#/database/runtime/Model.js'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {loadDevCheckpoint} from './DevCheckpoint.js'

test('loads only a compatible development checkpoint with an existing payload', async () => {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'alinea-dev-checkpoint-')
  )
  const bundleDir = path.join(rootDir, 'node_modules/@alinea/generated')
  const payloadFile = path.join(rootDir, 'public/admin/release/payload.bundle')
  const context = {
    cmd: 'dev' as const,
    wasmCache: false,
    rootDir,
    configLocation: path.join(rootDir, 'cms.ts'),
    configDir: rootDir,
    staticDir: rootDir,
    quiet: true,
    bundleDir,
    fix: false
  }
  const index: RuntimeDatabaseIndex = {
    version: 1,
    revision: 'tree',
    bundleId: 'release',
    bundleUrl: '/admin/release/payload.bundle',
    entries: [],
    children: {},
    source: {tree: {sha: 'tree', entries: []}, blobs: {}},
    development: {configHash: 'config', files: {}}
  }
  try {
    await fs.mkdir(bundleDir, {recursive: true})
    await fs.mkdir(path.dirname(payloadFile), {recursive: true})
    await fs.writeFile(
      path.join(bundleDir, 'runtime-index.js'),
      `export default ${JSON.stringify(index)}`
    )
    await fs.writeFile(payloadFile, '')

    expect(
      await loadDevCheckpoint(context, {publicDir: 'public'} as never, 'config')
    ).toEqual({index, payloadFile})
    expect(
      await loadDevCheckpoint(
        context,
        {publicDir: 'public'} as never,
        'different-config'
      )
    ).toBeUndefined()
  } finally {
    await fs.rm(rootDir, {recursive: true, force: true})
  }
})
