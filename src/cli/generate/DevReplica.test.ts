import {expect, spyOn, test} from 'bun:test'
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {tmpdir} from 'node:os'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {EntryResolver} from '#/core/db/EntryResolver.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {DevDB} from './DevDB.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {fillCache} from './FillCache.js'

test('dev queries use SQLite, writes reconcile before returning and restarts reuse the checkpoint', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-dev-sql-'))
  const Page = Config.document('Page', {fields: {title: Field.text('Title')}})
  const config = {
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const replica = {
    directory: join(rootDir, 'private-cache'),
    identity: {
      project: 'project',
      namespace: 'main',
      epoch: '1',
      schemaId: 'schema',
      configId: 'config',
      releaseId: 'release'
    }
  }
  const fixture = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Original'}
  ])
  for (const [path, node] of await fixture.source.getTree()) {
    if (node.type === 'tree') continue
    const location = join(rootDir, 'content', path)
    await mkdir(dirname(location), {recursive: true})
    for await (const [, bytes] of fixture.source.getBlobs([node.sha]))
      await writeFile(location, bytes)
  }
  const options = {config, rootDir, dashboardUrl: undefined, replica}
  const db = new DevDB(options)
  try {
    await db.sync()
    const oldResolve = spyOn(
      EntryResolver.prototype,
      'resolve'
    ).mockImplementation(() => {
      throw new Error('Unexpected JS query resolver')
    })
    try {
      expect(await db.find({select: Entry.title})).toEqual(['Original'])
    } finally {
      oldResolve.mockRestore()
    }
    const initial = Promise.withResolvers<unknown>()
    const changed = Promise.withResolvers<unknown>()
    let deliveries = 0
    const stop = db.subscribe(
      {select: Entry.title},
      {
        next(value) {
          ;(++deliveries === 1 ? initial : changed).resolve(value)
        },
        error(error) {
          initial.reject(error)
          changed.reject(error)
        }
      }
    )
    expect(await initial.promise).toEqual(['Original'])
    const oldMutations = spyOn(db.index, 'mutationReader').mockImplementation(
      () => {
        throw new Error('Unexpected JS mutation reader')
      }
    )
    try {
      const result = await db.update({
        type: Page,
        id: 'a',
        set: {title: 'Updated'}
      })
      expect(result.title).toBe('Updated')
    } finally {
      oldMutations.mockRestore()
    }
    expect(await changed.promise).toEqual(['Updated'])
    expect(await db.find({search: 'updat', select: Entry.id})).toEqual(['a'])
    expect(db.sha).toBe((await db.source.getTree()).sha)
    const servedRevision = db.sha
    const mutationTree = db.index.tree
    db.index.tree = ReadonlyTree.EMPTY
    try {
      await expect(
        db.write({
          description: 'Overlapping write',
          fromSha: servedRevision,
          intoSha: 'next',
          changes: []
        })
      ).rejects.toThrow('SHA mismatch')
    } finally {
      db.index.tree = mutationTree
    }
    stop()
    const pointer = await readFile(
      join(replica.directory, 'current.json'),
      'utf8'
    )
    await db.close()
    await expect(db.find({select: Entry.id})).rejects.toThrow('closed')
    const restarted = new DevDB(options)
    const indexing = fillCache(restarted)
    try {
      expect((await indexing[Symbol.asyncIterator]().next()).value).toBe(
        restarted
      )
      expect(await restarted.find({select: Entry.title})).toEqual(['Updated'])
      expect(
        await readFile(join(replica.directory, 'current.json'), 'utf8')
      ).toBe(pointer)
    } finally {
      indexing.return()
      await restarted.close()
    }
  } finally {
    await db.close()
    await rm(rootDir, {recursive: true, force: true})
  }
})
