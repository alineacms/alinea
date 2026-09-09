import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {connect} from 'rado/driver/bun-sqlite'
import {hashBlob} from '#/core/source/GitUtils.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {syncWith, transaction} from '#/core/source/Source.js'
import {SqlSource} from './SqlSource.js'

const bytes = (text: string) => new TextEncoder().encode(text)

test('reopens a raw source database with trees and binary blobs intact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-sql-source-'))
  const path = join(directory, 'source.sqlite')
  try {
    const remote = new MemorySource()
    const edit = await transaction(remote)
    edit.add('pages/home.json', bytes('{"title":"Home"}'))
    edit.add('media/image.bin', new Uint8Array([0, 128, 255]))
    const change = await edit.compile()
    await remote.applyChanges({
      fromSha: change.from.sha,
      changes: change.changes
    })
    {
      using sqlite = new Database(path)
      const db = connect(sqlite)
      await SqlSource.createSchema(db)
      const source = await SqlSource.create(db, 'main')
      await syncWith(source, remote)
      expect((await source.getSqlTree()).sha).toBe(change.into.sha)
    }
    {
      using sqlite = new Database(path, {readonly: true})
      const source = new SqlSource(connect(sqlite), 'main')
      expect(await source.getTreeIfDifferent(change.into.sha)).toBeUndefined()
      expect((await source.getTree()).diff(change.into).changes).toEqual([])
      const sha = await hashBlob(new Uint8Array([0, 128, 255]))
      expect(await Array.fromAsync(source.getBlobs([sha]))).toEqual([
        [sha, new Uint8Array([0, 128, 255])]
      ])
    }
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('forked namespaces retain old snapshots and reuse existing blobs', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await SqlSource.createSchema(db)
  const main = await SqlSource.create(db, 'main')
  const contents = bytes('Original')
  const sha = await hashBlob(contents)
  await main.applyChanges({
    fromSha: (await main.getSqlTree()).sha,
    changes: [{op: 'add', path: 'original.txt', sha, contents}]
  })
  const initial = await main.getSqlTree()
  const preview = await SqlSource.create(db, 'preview/feature', initial.sha)
  await preview.applyChanges({
    fromSha: initial.sha,
    changes: [
      {op: 'delete', path: 'original.txt', sha},
      {op: 'add', path: 'renamed.txt', sha}
    ]
  })
  expect((await main.getSqlTree()).sha).toBe(initial.sha)
  expect(await initial.get('original.txt')).toMatchObject({sha})
  const next = await preview.getSqlTree()
  expect(await next.get('original.txt')).toBeUndefined()
  expect(await next.get('renamed.txt')).toMatchObject({sha})
  expect((await initial.diff(next)).changes.map(change => change.path)).toEqual(
    ['original.txt', 'renamed.txt']
  )
  const second = await SqlSource.create(db, 'second-preview', initial.sha)
  expect((await second.getTree()).sha).toBe(initial.sha)
})

test('invalid batches roll back blobs and the head, and queued stale writes fail', async () => {
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await SqlSource.createSchema(db)
  const source = await SqlSource.create(db, 'main')
  const initial = (await source.getSqlTree()).sha
  const contents = bytes('Valid')
  const sha = await hashBlob(contents)
  await expect(
    source.applyChanges({
      fromSha: initial,
      changes: [
        {op: 'add', path: 'valid.txt', sha, contents},
        {op: 'add', path: 'corrupt.txt', sha, contents: bytes('Invalid')}
      ]
    })
  ).rejects.toThrow('Invalid source blob hash')
  expect((await source.getSqlTree()).sha).toBe(initial)
  await expect(Array.fromAsync(source.getBlobs([sha]))).rejects.toThrow(
    'Missing source blob'
  )
  const first = source.applyChanges({
    fromSha: initial,
    changes: [{op: 'add', path: 'valid.txt', sha, contents}]
  })
  const stale = source.applyChanges({fromSha: initial, changes: []})
  await first
  await expect(stale).rejects.toThrow()
  const current = (await source.getSqlTree()).sha
  await expect(
    source.applyChanges({
      fromSha: current,
      changes: [{op: 'delete', path: 'valid.txt', sha: 'wrong'}]
    })
  ).rejects.toThrow('Source changed')
  expect((await source.getSqlTree()).sha).toBe(current)
  await source.applyChanges({
    fromSha: current,
    changes: [{op: 'delete', path: 'valid.txt', sha}]
  })
  expect((await source.getSqlTree()).sha).toBe(initial)
  const abort = new AbortController()
  abort.abort(new Error('Cancelled'))
  await expect(
    Array.fromAsync(source.getBlobs([sha], {signal: abort.signal}))
  ).rejects.toThrow('Cancelled')
})
