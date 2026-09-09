import {expect, spyOn, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {connect} from 'rado/driver/bun-sqlite'
import {Config, Field} from '#/index.js'
import {children} from '#/query.js'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {snippet} from '#/core/pages/Snippet.js'
import {Field as FieldUtils} from '#/core/Field.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {buildDatabase} from '../runtime/BuildDatabase.js'
import {EntryRuntime} from '../runtime/EntryRuntime.js'
import {openCheckpoint} from '../runtime/Checkpoint.js'
import {entrySource, entryVersionId} from '../entry/Schema.js'
import {SqlSource} from '../source/SqlSource.js'
import {NodeOverlay} from './NodeOverlay.js'

const Page = Config.document('Page', {
  fields: {
    title: Field.text('Title'),
    body: Field.text('Body', {searchable: true})
  }
})
const config = {
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
}
const identity = {
  project: 'project',
  namespace: 'main',
  epoch: '1',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release'
}

test('attached row overlays isolate concurrent views without copying the checkpoint or rebuilding its corpus', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-overlay-'))
  const file = join(directory, 'private checkpoint.sqlite')
  const fixture = await createEntryResolver(config, [
    {id: 'a', type: 'Page', index: 'a', title: 'Original'},
    {id: 'child', type: 'Page', index: 'b', parentPaths: ['a'], title: 'Child'},
    {id: 'other', type: 'Page', index: 'c', title: 'Other'}
  ])
  const entry = fixture.index.findFirst(entry => entry.id === 'a')!
  const replacement = (title: string) => ({
    entry: {...entry, title, versionStatus: 'published' as const, ordinal: 0},
    payloadId: title,
    data: {...entry.data, title},
    source: entrySource(entry)
  })
  try {
    {
      using sqlite = new Database(file)
      await buildDatabase(config, connect(sqlite), fixture.source, identity)
    }
    const before = await readFile(file)
    const readBlobs = spyOn(SqlSource.prototype, 'getBlobs')
    const normalize = spyOn(EntryIndex.prototype, 'syncWith')
    const left = await NodeOverlay.open(config, file, identity, [
      replacement('Left')
    ])
    const right = await NodeOverlay.open(
      config,
      file,
      identity,
      [replacement('Right')],
      [entryVersionId('other', null, 'published')]
    )
    try {
      expect(await left.first({id: 'a', select: Entry.title})).toBe('Left')
      expect(await right.first({id: 'a', select: Entry.title})).toBe('Right')
      expect(await left.count({})).toBe(3)
      expect(await right.count({})).toBe(2)
      expect(
        await left.first({
          id: 'a',
          select: {
            title: Entry.title,
            children: children({select: Entry.title})
          }
        })
      ).toEqual({title: 'Left', children: ['Child']})
      expect(
        await right.find({
          filter: {title: 'Right'},
          type: Page,
          select: Entry.id
        })
      ).toEqual(['a'])
      expect(await left.find({search: 'Original', select: Entry.id})).toEqual(
        []
      )
      expect(await left.find({search: 'Left', select: Entry.id})).toEqual(['a'])
      expect(await right.find({search: 'Left', select: Entry.id})).toEqual([])
      expect(readBlobs).not.toHaveBeenCalled()
      expect(normalize).not.toHaveBeenCalled()
      expect(await readdir(directory)).toEqual(['private checkpoint.sqlite'])
      expect(await readFile(file)).toEqual(before)
      using sqlite = new Database(file, {readonly: true})
      const base = await openCheckpoint(config, connect(sqlite), identity)
      expect(await base.runtime.first({id: 'a', select: Entry.title})).toBe(
        'Original'
      )
      await expect(
        NodeOverlay.open(config, file, {...identity, namespace: 'other'}, [])
      ).rejects.toThrow('namespace mismatch')
      await expect(
        NodeOverlay.open(
          config,
          file,
          identity,
          [replacement('Invalid')],
          [entryVersionId('a', null, 'published')]
        )
      ).rejects.toThrow('replace and remove')
      const started = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const queryValue = FieldUtils.queryValue
      const processing = spyOn(FieldUtils, 'queryValue').mockImplementation(
        async (field, value, context) => {
          if (value === 'Left') {
            started.resolve()
            await release.promise
          }
          return queryValue(field, value, context)
        }
      )
      try {
        const pending = left.first({
          id: 'a',
          select: {title: Page.title, children: children({select: Entry.title})}
        })
        await started.promise
        left.close()
        release.resolve()
        expect(await pending).toEqual({title: 'Left', children: ['Child']})
      } finally {
        release.resolve()
        processing.mockRestore()
      }
    } finally {
      left.close()
      right.close()
      readBlobs.mockRestore()
      normalize.mockRestore()
    }
    await expect(left.find({select: Entry.id})).rejects.toThrow('closed')
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('overlay Graph search matches a rebuilt corpus for snippets, paging, grouping and concurrent nested queries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-overlay-search-'))
  const file = join(directory, 'base.sqlite')
  const fixture = await createEntryResolver(config, [
    {
      id: 'a',
      type: 'Page',
      index: 'a',
      title: 'Alpha parent',
      data: {body: 'vanilla'}
    },
    {
      id: 'child',
      type: 'Page',
      index: 'b',
      parentPaths: ['a'],
      title: 'Alpha child',
      data: {body: 'alpha beta recipes'}
    },
    {
      id: 'cafe',
      type: 'Page',
      index: 'c',
      title: 'Café',
      data: {body: 'alpha delicious café'}
    },
    {
      id: 'deleted',
      type: 'Page',
      index: 'd',
      title: 'Alpha removed',
      data: {body: 'alpha '.repeat(150)}
    },
    ...Array.from({length: 110}, (_, index) => ({
      id: `filler${index}`,
      type: 'Page',
      index: `e${index}`,
      title: 'Other',
      data: {body: 'alpha irrelevant text'}
    }))
  ])
  const entry = fixture.index.findFirst(entry => entry.id === 'a')!
  const replacement = {
    entry: {
      ...entry,
      title: 'Gamma parent',
      versionStatus: 'published' as const,
      ordinal: 0
    },
    payloadId: 'replacement',
    data: {...entry.data, title: 'Gamma parent', body: 'new alpha beta recipe'},
    source: {...entrySource(entry), searchableText: 'new alpha beta recipe'}
  }
  const removedVersionIds = [entryVersionId('deleted', null, 'published')]
  try {
    {
      using sqlite = new Database(file)
      await buildDatabase(config, connect(sqlite), fixture.source, identity)
    }
    const before = await readFile(file)
    using oracleSqlite = new Database(':memory:')
    const oracleDb = connect(oracleSqlite)
    await buildDatabase(config, oracleDb, fixture.source, identity)
    const oracle = new EntryRuntime(config, oracleDb)
    await oracle.apply({
      fromRevision: await oracle.getRevision(),
      toRevision: 'updated',
      entries: [replacement],
      removedVersionIds
    })
    const overlay = await NodeOverlay.open(
      config,
      file,
      identity,
      [replacement],
      removedVersionIds
    )
    try {
      const queries: Array<GraphQuery> = [
        {search: 'alpha', select: Entry.id},
        {
          search: ['alpha', 'beta'],
          select: {id: Entry.id, snippet: snippet('[', ']', '...', 4)}
        },
        {search: 'cafe', select: snippet()},
        {search: 'alpha', skip: 2, take: 5, select: Entry.id},
        {search: 'alpha', skip: 2, count: true},
        {search: 'alpha', groupBy: Entry.type, select: Entry.id},
        {search: 'alpha', orderBy: {desc: Entry.id}, take: 4, select: Entry.id},
        {
          search: 'alpha',
          filter: {_id: 'a'},
          type: Page,
          select: Entry.id
        },
        {search: 'vanilla', select: Entry.id},
        {search: '!!!', select: Entry.id},
        {search: '\u0301', select: Entry.id},
        {
          id: 'a',
          search: 'gamma',
          select: {
            title: Entry.title,
            alpha: children({
              search: 'alpha',
              select: {title: Entry.title, snippet: snippet()}
            }),
            beta: children({search: 'beta', select: Entry.id})
          }
        }
      ]
      expect(
        await Promise.all(queries.map(query => overlay.resolve(query)))
      ).toEqual(await Promise.all(queries.map(query => oracle.resolve(query))))
      expect(await overlay.find({search: 'vanilla', select: Entry.id})).toEqual(
        []
      )
      expect(await overlay.find({search: 'gamma', select: Entry.id})).toEqual([
        'a'
      ])
      expect(await overlay.count({search: 'alpha'})).toBe(113)
      expect(
        await overlay.find({
          search: 'alpha',
          type: Page,
          filter: {body: {startsWith: 'new'}},
          select: Entry.id
        })
      ).toEqual(['a'])
      expect(
        await overlay.first({
          id: 'child',
          search: 'alpha',
          select: snippet('[', ']')
        })
      ).toContain('[alpha]')
      await expect(
        overlay.find({search: 'alpha', select: snippet('[', ']', '...', 0)})
      ).rejects.toThrow('integer from 1 to 64')
      expect(await readFile(file)).toEqual(before)
      expect(await readdir(directory)).toEqual(['base.sqlite'])
    } finally {
      overlay.close()
    }
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})
