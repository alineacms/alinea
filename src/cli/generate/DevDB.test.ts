import {createConfig} from '#/core/Config.js'
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import {Entry} from '#/core/Entry.js'
import {FSSource} from '#/core/source/FSSource.js'
import {workspace} from '#/core/Workspace.js'
import {exportRuntimeDatabase} from '#/database/runtime/Exporter.js'
import {cms} from '#test/cms.js'
import {suite} from '@alinea/suite'
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

const staleTest = suite(import.meta)

staleTest('rejects stale commits before removing media files', async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'alinea-dev-db-'))
  const mediaFile = path.join(rootDir, 'public/media/example.jpg')
  await fs.mkdir(path.join(rootDir, 'content'), {recursive: true})
  await fs.mkdir(path.dirname(mediaFile), {recursive: true})
  await fs.writeFile(mediaFile, 'media')
  try {
    const config = createConfig({
      handlerUrl: '/api/cms',
      schema: {},
      workspaces: {
        main: workspace('Main', {
          source: 'content',
          mediaDir: 'public/media',
          roots: {}
        })
      }
    })
    const db = new DevDB({config, rootDir, dashboardUrl: undefined})
    await db.sync()
    const request: CommitRequest = {
      description: 'Stale media removal',
      fromSha: 'stale',
      intoSha: 'next',
      changes: [{op: 'removeFile', location: 'public/media/example.jpg'}]
    }

    await staleTest.throws(() => db.write(request), 'SHA mismatch')
    staleTest.is(await fs.readFile(mediaFile, 'utf8'), 'media')
  } finally {
    await fs.rm(rootDir, {recursive: true, force: true})
  }
})
