import {expect, spyOn, test} from 'bun:test'
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {dirname, join} from 'node:path'
import {tmpdir} from 'node:os'
import {Config, Field} from '#/index.js'
import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import {EntryResolver} from '#/core/db/EntryResolver.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {DevDB} from './DevDB.js'
import {VersionParser} from '#/core/db/EntryIndex.js'
import {fillCache} from './FillCache.js'

test('SQL dev writes serialize source commits and reject stale or malformed requests before media effects', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-dev-writes-'))
  const Page = Config.document('Page', {fields: {title: Field.text('Title')}})
  const config = {
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        mediaDir: 'public/media',
        roots: {pages: Config.root('Pages', {contains: ['Page']})}
      })
    }
  }
  await mkdir(join(rootDir, 'content'), {recursive: true})
  await mkdir(join(rootDir, 'public/media'), {recursive: true})
  const media = join(rootDir, 'public/media/keep.txt')
  await writeFile(media, 'keep')
  const db = new DevDB({
    config,
    rootDir,
    dashboardUrl: undefined,
    replica: {
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
  })
  try {
    await db.sync()
    await db.mutate([
      {
        op: 'create',
        id: 'a',
        type: 'Page',
        locale: null,
        root: 'pages',
        data: {title: 'Original'}
      }
    ])
    const first = await db.request([
      {
        op: 'update',
        id: 'a',
        locale: null,
        status: 'published',
        set: {title: 'First'}
      }
    ])
    const second = await db.request([
      {
        op: 'update',
        id: 'a',
        locale: null,
        status: 'published',
        set: {title: 'Second'}
      }
    ])
    second.changes.push({op: 'removeFile', location: 'public/media/keep.txt'})
    await expect(db.write({...second, intoSha: 'invalid'})).rejects.toThrow(
      'target revision mismatch'
    )
    await expect(
      db.write({
        ...second,
        changes: second.changes.map(change =>
          change.op === 'addContent'
            ? {...change, contents: `${change.contents}\n`}
            : change
        )
      })
    ).rejects.toThrow('blob hash mismatch')
    expect(await readFile(media, 'utf8')).toBe('keep')
    const results = await Promise.allSettled([
      db.write(first),
      db.write(second)
    ])
    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(await db.first({id: 'a', select: Entry.title})).toBe('First')
    expect(db.sha).toBe(first.intoSha)
    expect(await readFile(media, 'utf8')).toBe('keep')
    expect(await db.write(first)).toEqual({sha: first.intoSha})
  } finally {
    await db.close()
    await rm(rootDir, {recursive: true, force: true})
  }
})

test('SQL dev seeding preserves localized identities and config-only defaults without the JS seed path', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-dev-seeds-'))
  const Page = Config.document('Page', {fields: {title: Field.text('Title')}})
  const cms = createCMS({
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {
          pages: Config.root('Pages', {
            i18n: {locales: ['en', 'de']},
            children: {
              home: Config.page({
                type: Page,
                fields: {title: 'Home'},
                children: {
                  child: Config.page({type: Page, fields: {title: 'Child'}})
                }
              })
            }
          })
        }
      })
    }
  })
  await mkdir(join(rootDir, 'content'), {recursive: true})
  const options = {
    config: cms.config,
    rootDir,
    dashboardUrl: undefined,
    replica: {
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
  }
  const db = new DevDB(options)
  const legacySeed = spyOn(db.index, 'seed').mockImplementation(() => {
    throw new Error('Unexpected JS seeding')
  })
  const legacyIndex = spyOn(db.index, 'syncWith').mockImplementation(() => {
    throw new Error('Unexpected JS indexing')
  })
  try {
    await db.sync()
    const rows = await db.find({
      status: 'all',
      select: {
        id: Entry.id,
        parentId: Entry.parentId,
        path: Entry.path,
        title: Entry.title,
        locale: Entry.locale,
        filePath: Entry.filePath
      }
    })
    expect(rows).toHaveLength(4)
    for (const path of ['home', 'child']) {
      const localized = rows.filter(row => row.path === path)
      expect(new Set(localized.map(row => row.id)).size).toBe(1)
      expect(localized.map(row => row.locale).sort()).toEqual(['de', 'en'])
      expect(localized.map(row => row.title)).toEqual(
        path === 'home' ? ['Home', 'Home'] : ['Child', 'Child']
      )
    }
    const home = rows.find(row => row.path === 'home')!
    expect(
      rows.filter(row => row.path === 'child').map(row => row.parentId)
    ).toEqual([home.id, home.id])
    for (const row of rows) {
      const record = JSON.parse(
        await readFile(join(rootDir, 'content', row.filePath), 'utf8')
      )
      expect(Object.hasOwn(record, 'title')).toBe(false)
    }
    await db.update({
      type: Page,
      id: home.id,
      locale: 'en',
      set: {path: 'start'}
    })
    expect(await db.find({status: 'all', select: Entry.id})).toHaveLength(4)
    expect(
      await db.find({id: home.id, locale: 'en', select: Entry.path})
    ).toEqual(['start'])
    await db.update({
      type: Page,
      id: home.id,
      locale: 'en',
      set: {title: 'Edited'}
    })
    expect(
      await db.find({id: home.id, locale: 'en', select: Entry.path})
    ).toEqual(['start'])
    expect(
      await db.find({path: 'child', locale: 'en', select: Entry.title})
    ).toEqual(['Child'])
    const revision = db.sha
    const pointer = await readFile(
      join(options.replica.directory, 'current.json'),
      'utf8'
    )
    await db.sync()
    expect(db.sha).toBe(revision)
    expect(
      await readFile(join(options.replica.directory, 'current.json'), 'utf8')
    ).toBe(pointer)
    await db.close()
    const reopened = new DevDB(options)
    try {
      await reopened.sync()
      expect(reopened.sha).toBe(revision)
      expect(
        (await reopened.find({status: 'all', select: Entry.id})).sort()
      ).toEqual(rows.map(row => row.id).sort())
    } finally {
      await reopened.close()
    }
  } finally {
    legacySeed.mockRestore()
    legacyIndex.mockRestore()
    await db.close()
    await rm(rootDir, {recursive: true, force: true})
  }
})

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
  const legacyIndex = spyOn(db.index, 'syncWith').mockImplementation(() => {
    throw new Error('Unexpected JS indexing')
  })
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
    const contentFile = join(rootDir, 'content/pages/a.json')
    const content = await readFile(contentFile, 'utf8')
    await writeFile(contentFile, JSON.stringify(JSON.parse(content)))
    await db.fix()
    expect(await readFile(contentFile, 'utf8')).toBe(content)
    const fixedRevision = db.sha
    await db.fix()
    expect(db.sha).toBe(fixedRevision)
    await writeFile(contentFile, `${content}\n`)
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
      await writeFile(contentFile, content)
      await db.sync()
    }
    stop()
    const pointer = await readFile(
      join(replica.directory, 'current.json'),
      'utf8'
    )
    await db.close()
    await expect(db.find({select: Entry.id})).rejects.toThrow('closed')
    const restarted = new DevDB(options)
    const parsing = spyOn(VersionParser.prototype, 'parse')
    const indexing = fillCache(restarted)
    try {
      expect((await indexing[Symbol.asyncIterator]().next()).value).toBe(
        restarted
      )
      expect(await restarted.find({select: Entry.title})).toEqual(['Updated'])
      expect(
        (await restarted.referencesTo({targetId: 'a'})).scan.complete
      ).toBe(true)
      expect(parsing).not.toHaveBeenCalled()
      expect(
        await readFile(join(replica.directory, 'current.json'), 'utf8')
      ).toBe(pointer)
      // Only the remaining preview path materializes the legacy index.
      const entry = await restarted.get({id: 'a', select: Entry})
      expect(
        await restarted.first({
          id: 'a',
          select: Entry.title,
          preview: {
            entry: {
              ...entry,
              fileHash: 'preview',
              data: {...entry.data, title: 'Preview'}
            }
          }
        })
      ).toBe('Preview')
      expect(parsing).toHaveBeenCalled()
      expect(
        (await restarted.referencesTo({targetId: 'a'})).scan.complete
      ).toBe(true)
      expect(await restarted.first({id: 'a', select: Entry.title})).toBe(
        'Updated'
      )
      await restarted.fix()
      expect(await restarted.first({id: 'a', select: Entry.title})).toBe(
        'Updated'
      )
    } finally {
      indexing.return()
      parsing.mockRestore()
      await restarted.close()
    }
  } finally {
    legacyIndex.mockRestore()
    await db.close()
    await rm(rootDir, {recursive: true, force: true})
  }
})
