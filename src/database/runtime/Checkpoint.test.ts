import {expect, spyOn, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {mkdtemp, rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {connect} from 'rado/driver/bun-sqlite'
import {eq} from 'rado'
import {Config, Field} from '#/index.js'
import {Entry} from '#/core/Entry.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {EntryResolver} from '#/core/db/EntryResolver.js'
import {FSSource} from '#/core/source/FSSource.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {cms} from '#test/cms.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {SqlSource} from '../source/SqlSource.js'
import {SqlTree} from '../source/SqlTree.js'
import {EntryIndexTable} from '../entry/Schema.js'
import {buildDatabase} from './BuildDatabase.js'
import {CheckpointTable, openCheckpoint} from './Checkpoint.js'

const identity = {
  project: 'project',
  epoch: 'epoch',
  schemaId: 'schema',
  configId: 'test-config-v1',
  namespace: 'main',
  releaseId: 'release-1'
}

test('builds and reopens a raw SQL checkpoint without source reads or normalization', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'alinea-checkpoint-'))
  const path = join(directory, 'release.sqlite')
  try {
    const source = new FSSource('test/fixtures/demo')
    const index = new EntryIndex(cms.config)
    await index.syncWith(source)
    const expected = await new EntryResolver(cms.config, index).resolve({
      select: Entry
    })
    {
      using sqlite = new Database(path)
      await buildDatabase(cms.config, connect(sqlite), source, identity)
    }
    const readBlobs = spyOn(SqlSource.prototype, 'getBlobs')
    const materialize = spyOn(SqlTree.prototype, 'toTree')
    const normalize = spyOn(EntryIndex.prototype, 'syncWith')
    try {
      using sqlite = new Database(path, {readonly: true})
      const db = connect(sqlite)
      const {runtime, descriptor} = await openCheckpoint(
        cms.config,
        db,
        identity
      )
      expect(descriptor.sourceSha).toBe(index.sha)
      expect(await runtime.find({select: Entry})).toEqual(expected)
      expect(await runtime.count({select: Entry.id})).toBe(expected.length)
      expect(await runtime.count({search: 'cookie'})).toBeGreaterThan(0)
      expect(readBlobs).not.toHaveBeenCalled()
      expect(materialize).not.toHaveBeenCalled()
      expect(normalize).not.toHaveBeenCalled()
      for (const key of [
        'project',
        'epoch',
        'schemaId',
        'configId',
        'namespace',
        'releaseId'
      ] as const)
        await expect(
          openCheckpoint(cms.config, db, {...identity, [key]: 'different'})
        ).rejects.toThrow(`${key} mismatch`)
    } finally {
      readBlobs.mockRestore()
      materialize.mockRestore()
      normalize.mockRestore()
    }
  } finally {
    await rm(directory, {recursive: true, force: true})
  }
})

test('checkpoint queries preserve inherited status and retain inactive authored versions', async () => {
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
  const {source, resolver} = await createEntryResolver(config, [
    {id: 'parent', type: 'Page', index: 'a', status: 'archived'},
    {
      id: 'child',
      type: 'Page',
      index: 'b',
      parentPaths: ['parent'],
      status: 'published',
      title: 'Published'
    },
    {
      id: 'child',
      type: 'Page',
      index: 'b',
      parentPaths: ['parent'],
      status: 'draft',
      title: 'Draft'
    }
  ])
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, source, identity)
  const {runtime} = await openCheckpoint(config, db, identity)
  expect(await runtime.find({status: 'all', select: Entry})).toEqual(
    await resolver.resolve({status: 'all', select: Entry})
  )
  const versions = await db
    .select({
      source: EntryIndexTable.versionStatus,
      effective: EntryIndexTable.status
    })
    .from(EntryIndexTable)
    .where(eq(EntryIndexTable.id, 'child'))
    .orderBy(EntryIndexTable.versionStatus)
  expect(versions).toEqual([{source: 'draft', effective: 'archived'}])
  const tree = await new SqlSource(db, identity.namespace).getSqlTree()
  expect(await tree.get('pages/parent/child.json')).toBeDefined()
  expect(await tree.get('pages/parent/child.draft.json')).toBeDefined()
  await db
    .update(CheckpointTable)
    .set({sourceSha: 'wrong'})
    .where(eq(CheckpointTable.id, 1))
  await expect(openCheckpoint(config, db, identity)).rejects.toThrow(
    'revision mismatch'
  )
})

test('failed normalization does not publish a partial checkpoint or source head', async () => {
  const source = new MemorySource()
  const contents = new TextEncoder().encode('not json')
  const sha = await hashBlob(contents)
  await source.applyChanges({
    fromSha: (await source.getTree()).sha,
    changes: [{op: 'add', path: 'pages/broken.json', sha, contents}]
  })
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await expect(
    buildDatabase(cms.config, db, source, identity)
  ).rejects.toThrow()
  expect(await db.select().from(CheckpointTable)).toEqual([])
  expect(await db.select().from(EntryIndexTable)).toEqual([])
  await expect(
    new SqlSource(db, identity.namespace).getSqlTree()
  ).rejects.toThrow('Missing source namespace')
  await expect(openCheckpoint(cms.config, db, identity)).rejects.toThrow(
    'incomplete'
  )
})
