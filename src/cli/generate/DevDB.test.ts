import {Entry} from '#/core/Entry.js'
import {FSSource} from '#/core/source/FSSource.js'
import {exportRuntimeDatabase} from '#/database/runtime/Exporter.js'
import {cms} from '#test/cms.js'
import {expect, test} from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {DevDB} from './DevDB.js'

test('boots from a checkpoint and overlays an edited source file', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'alinea-dev-db-'))
  const contentDir = path.join(rootDir, 'content/demo')
  const payloadFile = path.join(rootDir, 'payload.bundle')
  try {
    await fs.mkdir(path.dirname(contentDir), {recursive: true})
    await fs.cp('test/fixtures/demo', contentDir, {recursive: true})
    const source = new FSSource(contentDir)
    const release = await exportRuntimeDatabase({
      config: cms.config,
      bundleId: 'checkpoint',
      bundleUrl: '/payload.bundle',
      source,
      compression: 'none'
    })
    await fs.writeFile(payloadFile, release.bundle)
    const db = new DevDB({
      config: cms.config,
      rootDir,
      dashboardUrl: undefined,
      checkpoint: {
        payloadFile,
        index: {
          ...release.index,
          development: {
            configHash: 'config',
            files: source.snapshot().files
          }
        }
      }
    })

    await db.sync()
    expect(
      await db.resolve({
        id: 'vTCpgsHfAjZtHabyjb8RG',
        select: Entry.title,
        first: true
      })
    ).toBe('Milk & Cookies')

    const location = path.join(contentDir, 'pages/index.json')
    const record = JSON.parse(await fs.readFile(location, 'utf8'))
    record.title = 'Checkpoint updated'
    await fs.writeFile(location, JSON.stringify(record, null, 2))
    await db.sync()

    expect(
      await db.resolve({
        id: 'vTCpgsHfAjZtHabyjb8RG',
        select: Entry.title,
        first: true
      })
    ).toBe('Checkpoint updated')

    await db.mutate([
      {op: 'archive', id: 'vTCpgsHfAjZtHabyjb8RG', locale: null}
    ])
    expect(
      await db.resolve({
        id: 'vTCpgsHfAjZtHabyjb8RG',
        status: 'all',
        select: Entry.status,
        first: true
      })
    ).toBe('archived')
  } finally {
    await fs.rm(rootDir, {recursive: true, force: true})
  }
})
