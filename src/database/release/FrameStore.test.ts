import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {config, entry} from '#test/sqlite-browser/config.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import {entryVersionId} from '../entry/Schema.js'
import {buildDatabase} from '../runtime/BuildDatabase.js'
import {openCheckpoint} from '../runtime/Checkpoint.js'
import {decryptFrame} from '../replica/Frame.js'
import {FrameStore, FrameTable, buildFrames} from './FrameStore.js'

test('release frame generation rejects sparse entry data without publishing partial frames', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await EntryRuntime.createSchema(db, 'empty')
  const runtime = new EntryRuntime(config, db)
  await runtime.apply({
    fromRevision: 'empty',
    toRevision: 'r1',
    entries: [
      {entry: entry('a'), payloadId: 'a', data: {}},
      {entry: entry('b'), payloadId: 'b'}
    ]
  })
  await expect(
    buildFrames(db, {
      project: 'project',
      namespace: 'main',
      epoch: 'epoch',
      schemaId: 'schema',
      configId: 'config',
      releaseId: 'release'
    })
  ).rejects.toThrow('complete entry data')
  expect(await db.select().from(FrameTable)).toEqual([])
})

test('built frames reopen from a private checkpoint with stable keys and independently readable ciphertext', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-frames-'))
  const path = join(directory, 'release.sqlite')
  const identity = {
    project: 'project',
    epoch: 'epoch',
    schemaId: 'schema',
    configId: 'config',
    namespace: 'main',
    releaseId: 'release'
  }
  const binding = {
    ...identity,
    project: 'project',
    epoch: 'epoch',
    schemaId: 'schema'
  }
  try {
    let request!: {versionId: string; payloadId: string}
    let originalKey!: Uint8Array
    {
      using sqlite = new Database(path)
      const db = connect(sqlite)
      await buildDatabase(
        cms.config,
        db,
        new FSSource('test/fixtures/demo'),
        identity
      )
      const {runtime} = await openCheckpoint(cms.config, db, identity)
      const first = (await runtime.indexSnapshot()).entries[0]
      request = {
        versionId: entryVersionId(
          first.entry.id,
          first.entry.locale,
          first.entry.versionStatus
        ),
        payloadId: first.payloadId!
      }
      const store = new FrameStore(db)
      originalKey = (await store.grant({...binding, ...request, kind: 'data'}))
        .key
      await expect(
        store.put({...binding, ...request, kind: 'data'}, new Uint8Array([1]))
      ).rejects.toThrow()
      expect(
        (await store.grant({...binding, ...request, kind: 'data'})).key
      ).toEqual(originalKey)
    }
    {
      using sqlite = new Database(path, {readonly: true})
      const store = new FrameStore(connect(sqlite))
      const frame = {...binding, ...request, kind: 'data' as const}
      const grant = await store.grant(frame)
      expect(grant.key).toEqual(originalKey)
      expect(grant).not.toHaveProperty('ciphertext')
      const ciphertext = await store.ciphertext(frame)
      const decoded = JSON.parse(
        new TextDecoder().decode(
          await decryptFrame(frame, grant.descriptor, ciphertext, grant.key)
        )
      )
      expect(decoded.data).toBeObject()
      expect(decoded.source.filePath).toBeString()
      await expect(store.grant({...frame, releaseId: 'other'})).rejects.toThrow(
        'Missing'
      )
    }
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})
