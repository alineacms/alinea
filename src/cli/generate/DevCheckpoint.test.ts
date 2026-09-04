import {expect, test} from 'bun:test'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {base64url} from '#/core/util/Encoding.js'
import {encryptFrame, packEncryptedFrames} from '#/database/replica/Bundle.js'
import {serializeFrame} from '#/database/replica/Serialization.js'
import {encodeRuntimeSourceTree} from '#/database/runtime/FrameSerialization.js'
import type {RuntimeDatabaseIndex} from '#/database/runtime/Model.js'
import {serializeRuntimeDatabaseIndex} from '#/database/runtime/Serialization.js'
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
  const tree = ReadonlyTree.EMPTY
  const key = new Uint8Array(32).fill(7)
  const encrypted = await encryptFrame({
    bundleId: 'release',
    id: 'source:tree',
    accessClassId: 'source:release',
    key,
    contents: encodeRuntimeSourceTree(tree, new Map()),
    compression: 'none'
  })
  const payload = packEncryptedFrames([encrypted])
  const index: RuntimeDatabaseIndex = {
    revision: tree.sha,
    bundleId: 'release',
    bundleUrl: '/admin/release/payload.bundle',
    entries: [],
    source: {
      treeFrame: {
        decodeKey: base64url.stringify(key, {pad: false}),
        frame: serializeFrame(payload.frames[0])
      }
    },
    development: {configHash: 'config', files: {}}
  }
  try {
    await fs.mkdir(bundleDir, {recursive: true})
    await fs.mkdir(path.dirname(payloadFile), {recursive: true})
    await fs.writeFile(
      path.join(bundleDir, 'runtime-index.js'),
      `import {deserializeRuntimeDatabaseIndex as decode} from "alinea/database/runtime/Serialization"\nexport default decode(JSON.parse(${JSON.stringify(JSON.stringify(serializeRuntimeDatabaseIndex(index)))}))`
    )
    await fs.writeFile(payloadFile, payload.contents)

    expect(
      await loadDevCheckpoint(context, {publicDir: 'public'} as never, 'config')
    ).toEqual({
      index,
      payloadFile,
      sourceTree: expect.objectContaining({sha: tree.sha, entries: []})
    })
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
