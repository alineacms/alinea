import {expect, spyOn, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {copyFile, mkdtemp, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {VersionParser} from '#/core/db/EntryIndex.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {buildDatabase} from './BuildDatabase.js'
import {openCheckpoint} from './Checkpoint.js'
import {reconcileDatabase} from './ReconcileDatabase.js'
import {FrameTable} from '../release/FrameStore.js'

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
const identity = {
  project: 'project',
  namespace: 'main',
  epoch: '1',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release'
}

test('reconciliation retains hidden authored versions and recomputes inherited descendants', async () => {
  const children = [
    {
      id: 'child',
      type: 'Page',
      index: 'b',
      parentPaths: ['parent'],
      status: 'published' as const,
      title: 'Published child'
    },
    {
      id: 'child',
      type: 'Page',
      index: 'b',
      parentPaths: ['parent'],
      status: 'draft' as const,
      title: 'Draft child'
    }
  ]
  const baseline = await createEntryResolver(config, [
    {id: 'parent', type: 'Page', index: 'a', status: 'archived'},
    ...children
  ])
  const unarchived = await createEntryResolver(config, [
    {id: 'parent', type: 'Page', index: 'a', status: 'published'},
    ...children
  ])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, baseline.source, identity)
  const parse = spyOn(VersionParser.prototype, 'parse')
  try {
    const result = await reconcileDatabase(
      config,
      db,
      unarchived.source,
      identity
    )
    expect(result.parsed).toBeLessThanOrEqual(1)
    expect(parse).toHaveBeenCalledTimes(result.parsed)
    const {runtime} = await openCheckpoint(config, db, identity)
    for (const status of ['all', 'published', 'preferDraft'] as const)
      expect(await runtime.find({status, select: Entry})).toEqual(
        await unarchived.resolver.resolve({status, select: Entry})
      )
    expect(
      await runtime.find({status: 'all', id: 'child', select: Entry.title})
    ).toHaveLength(2)
  } finally {
    parse.mockRestore()
  }
})

test('reopens a writable copy, parses only changed source blobs and preserves unaffected SQL rows and frames', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-reconcile-'))
  try {
    const baseline = await createEntryResolver(config, [
      {id: 'a', type: 'Page', index: 'a', title: 'First'},
      {id: 'b', type: 'Page', index: 'b', title: 'Second'}
    ])
    const edited = await createEntryResolver(config, [
      {id: 'a', type: 'Page', index: 'a', title: 'Changed'},
      {id: 'b', type: 'Page', index: 'b', title: 'Second'}
    ])
    const original = join(directory, 'release.sqlite')
    {
      using sqlite = new Database(original)
      await buildDatabase(config, connect(sqlite), baseline.source, identity)
    }
    const copy = join(directory, 'working.sqlite')
    await copyFile(original, copy)
    using sqlite = new Database(copy)
    const db = connect(sqlite)
    const frames = await db.select().from(FrameTable)
    const dataRows = sqlite
      .query('select rowid, * from alinea_entry_data order by versionId')
      .all()
    const parse = spyOn(VersionParser.prototype, 'parse')
    try {
      expect(
        await reconcileDatabase(config, db, baseline.source, identity)
      ).toMatchObject({parsed: 0, replaced: 0, removed: 0})
      expect(parse).not.toHaveBeenCalled()
      expect(
        await reconcileDatabase(config, db, edited.source, identity)
      ).toMatchObject({parsed: 1, replaced: 1, removed: 0})
      expect(parse).toHaveBeenCalledTimes(1)
      expect(
        sqlite
          .query('select rowid, * from alinea_entry_data order by versionId')
          .all()[1]
      ).toEqual(dataRows[1])
      const nextFrames = await db.select().from(FrameTable)
      expect(nextFrames).toHaveLength(frames.length + 1)
      for (const frame of frames) expect(nextFrames).toContainEqual(frame)
      const {runtime} = await openCheckpoint(config, db, identity)
      expect(await runtime.find({select: Entry})).toEqual(
        await edited.resolver.resolve({select: Entry})
      )
      expect(await runtime.find({search: 'chang', select: Entry.id})).toEqual([
        'a'
      ])
      const revision = await runtime.getRevision()
      const contents = new TextEncoder().encode('invalid json')
      await edited.source.applyChanges({
        fromSha: revision,
        changes: [
          {
            op: 'add',
            path: 'pages/bad.json',
            sha: await hashBlob(contents),
            contents
          }
        ]
      })
      await expect(
        reconcileDatabase(config, db, edited.source, identity)
      ).rejects.toThrow()
      expect(
        (await openCheckpoint(config, db, identity)).descriptor.sourceSha
      ).toBe(revision)
      expect(await db.select().from(FrameTable)).toEqual(nextFrames)
      expect(
        await reconcileDatabase(config, db, baseline.source, identity)
      ).toMatchObject({parsed: 0, replaced: 1, removed: 0})
      expect(await db.select().from(FrameTable)).toEqual(nextFrames)
      using published = new Database(original, {readonly: true})
      expect(
        await (
          await openCheckpoint(config, connect(published), identity)
        ).runtime.find({select: Entry.title})
      ).toEqual(['First', 'Second'])
    } finally {
      parse.mockRestore()
    }
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})
