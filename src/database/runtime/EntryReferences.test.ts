import {expect, spyOn, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {eq} from 'rado'
import {Config, Field} from '#/index.js'
import {Type} from '#/core/Type.js'
import {Permission} from '#/core/Role.js'
import {EntryIndexTable} from '../entry/Schema.js'
import {
  createEntryResolver,
  type EntryFixtureEntry
} from '#test/EntryFixture.js'
import {buildDatabase} from './BuildDatabase.js'
import {reconcileDatabase} from './ReconcileDatabase.js'
import {entryReferencesTo, EntryReferenceTable} from './EntryReferences.js'
import {EntryDataTable, entryVersionId} from '../entry/Schema.js'

const Page = Config.document('Page', {
  fields: {
    title: Field.text('Title'),
    related: Field.entry.multiple('Related'),
    attachment: Field.file('Attachment'),
    hero: Field.image('Hero')
  }
})
const config = {
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages', {i18n: {locales: ['en', 'de']}})}
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
function link(entryId: string, id: string) {
  return {_id: id, _type: 'entry', _entry: entryId}
}
function entries(
  target = 'target',
  parentStatus: 'archived' | 'published' = 'archived'
): Array<EntryFixtureEntry> {
  return [
    {
      id: 'parent',
      type: 'Page',
      index: 'a',
      locale: 'en',
      status: parentStatus
    },
    {
      id: 'child',
      type: 'Page',
      index: 'a',
      locale: 'en',
      parentPaths: ['parent'],
      data: {related: [link('hidden', 'hidden')]}
    },
    {
      id: 'child',
      type: 'Page',
      index: 'a',
      locale: 'en',
      parentPaths: ['parent'],
      status: 'draft',
      data: {related: [link(target, 'child')]}
    },
    {
      id: 'source',
      type: 'Page',
      index: 'b',
      locale: 'en',
      data: {
        related: [link(target, 'one'), link(target, 'two')],
        attachment: {_id: 'file', _type: 'file', _entry: 'media'},
        hero: {_id: 'image', _type: 'image', _entry: 'media'}
      }
    },
    {
      id: 'source',
      type: 'Page',
      index: 'b',
      locale: 'en',
      status: 'draft',
      data: {related: [link('draft', 'draft')]}
    },
    {
      id: 'source',
      type: 'Page',
      index: 'b',
      locale: 'de',
      data: {related: [link(target, 'translated')]}
    }
  ]
}

test('private SQL references match Graph status, locale, duplicates and media metadata without resident payloads', async () => {
  const fixture = await createEntryResolver(config, entries())
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, fixture.source, identity)
  await db.delete(EntryDataTable)
  for (const targetId of ['target', 'draft', 'hidden', 'media', 'missing'])
    for (const status of [
      'all',
      'published',
      'draft',
      'archived',
      'preferDraft',
      'preferPublished'
    ] as const)
      for (const locale of [undefined, null, 'en', 'de']) {
        const query = {targetId, status, locale}
        expect(await entryReferencesTo(db, query)).toEqual(
          await fixture.index.referencesTo(query)
        )
      }
  expect(
    (await entryReferencesTo(db, {targetId: 'target', status: 'all'})).total
  ).toBeGreaterThan(0)
  expect(
    (await entryReferencesTo(db, {targetId: 'media'})).references.map(
      row => row.linkType
    )
  ).toEqual(['file', 'image'])
})

test('authorized references omit hidden sources and private scan counts', async () => {
  const fixture = await createEntryResolver(config, entries())
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, fixture.source, identity)
  await db.delete(EntryDataTable)
  const rows = await db.select().from(EntryIndexTable)
  const authorized = rows
    .filter(row => row.id === 'source')
    .map(entry => ({
      entry,
      permissions: Permission.Read | Permission.Explore
    }))
  const result = await entryReferencesTo(
    db,
    {targetId: 'target', status: 'all'},
    authorized
  )
  expect(result.references.map(row => row.linkId)).toEqual([
    'translated',
    'one',
    'two'
  ])
  expect(result.total).toBe(3)
  expect(result.scan).toEqual({
    scanned: authorized.length,
    total: authorized.length,
    complete: true
  })
  expect(
    (await entryReferencesTo(db, {targetId: 'media'}, authorized)).references
  ).toHaveLength(2)
  expect(
    (await entryReferencesTo(db, {targetId: 'target'}, [])).scan.total
  ).toBe(0)
  for (const row of authorized) row.permissions = Permission.Explore
  expect(
    (await entryReferencesTo(db, {targetId: 'target'}, authorized)).references
  ).toEqual([])
})

test('reconciliation updates changed references, retains unchanged rows, unmasks hidden versions and removes deleted sources', async () => {
  const baseline = await createEntryResolver(config, entries())
  const changed = await createEntryResolver(
    config,
    entries('other', 'published')
  )
  using sqlite = new Database(':memory:')
  const db = connect(sqlite)
  await buildDatabase(config, db, baseline.source, identity)
  const versionId = entryVersionId('child', 'en', 'published')
  const before = await db
    .select()
    .from(EntryReferenceTable)
    .where(eq(EntryReferenceTable.versionId, versionId))
  const original = await entryReferencesTo(db, {
    targetId: 'target',
    status: 'all'
  })
  const extracting = spyOn(Type, 'references').mockImplementation(() => {
    throw new Error('Reference extraction failed')
  })
  try {
    await expect(
      reconcileDatabase(config, db, changed.source, identity)
    ).rejects.toThrow('Reference extraction failed')
  } finally {
    extracting.mockRestore()
  }
  expect(
    await entryReferencesTo(db, {targetId: 'target', status: 'all'})
  ).toEqual(original)
  await reconcileDatabase(config, db, changed.source, identity)
  expect(
    await db
      .select()
      .from(EntryReferenceTable)
      .where(eq(EntryReferenceTable.versionId, versionId))
  ).toEqual(before)
  for (const targetId of ['target', 'other', 'hidden']) {
    const query = {targetId, status: 'all' as const}
    expect(await entryReferencesTo(db, query)).toEqual(
      await changed.index.referencesTo(query)
    )
  }
  const empty = await createEntryResolver(config, [])
  await reconcileDatabase(config, db, empty.source, identity)
  expect(await db.select().from(EntryReferenceTable)).toEqual([])
  expect(await entryReferencesTo(db, {targetId: 'other'})).toEqual({
    references: [],
    total: 0,
    scan: {scanned: 0, total: 0, complete: true}
  })
})
