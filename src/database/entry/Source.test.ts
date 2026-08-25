import {describe, expect, test} from 'bun:test'
import {cms} from '#test/cms.js'
import {createEntryIndex} from '#test/EntryFixture.js'
import {EntryIndex} from '#/core/db/EntryIndex.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {FSSource} from '#/core/source/FSSource.js'
import {EntryQueryEngine} from './Query.js'
import {referencesBySource} from './Indexes.js'
import {SourceEntryDatabase, buildEntryDatabase} from './Source.js'

const fixtureDirectory = 'test/fixtures/demo'

describe('source entry database', () => {
  test('normalizes the current fixture without using EntryIndex', async () => {
    const source = new FSSource(fixtureDirectory)
    const legacy = new EntryIndex(cms.config)
    await legacy.syncWith(source)
    const snapshot = await buildEntryDatabase(cms.config, source)
    const current = await new EntryQueryEngine(snapshot).find({
      status: 'published'
    })
    const expected = Array.from(
      legacy.filter({entry: entry => entry.status === 'published'})
    )

    expect(current.map(comparable).sort(compareComparable)).toEqual(
      expected
        .map(entry => ({
          id: entry.id,
          status: entry.status,
          title: entry.title,
          type: entry.type,
          parentId: entry.parentId,
          parents: entry.parents,
          workspace: entry.workspace,
          root: entry.root,
          locale: entry.locale,
          level: entry.level,
          index: entry.index,
          path: entry.path,
          url: entry.url
        }))
        .sort(compareComparable)
    )

    for (const entry of expected) {
      const previous = (await legacy.referencesFrom(entry.id)).map(
        reference => ({
          targetId: reference.targetId,
          sourceEntryId: reference.sourceId,
          sourceFilePath: reference.sourceFilePath,
          sourceType: reference.sourceType,
          sourceLocale: reference.sourceLocale,
          sourceStatus: reference.sourceStatus,
          sourceActive: reference.sourceActive,
          sourceMain: reference.sourceMain,
          fieldPath: reference.fieldPath,
          fieldLabel: reference.fieldLabel,
          linkId: reference.linkId,
          linkType: reference.linkType
        })
      )
      const next = snapshot
        .scan(referencesBySource, entry.id)
        .map(reference => {
          const {sourceVersionId: _sourceVersionId, ...metadata} =
            reference.metadata
          return metadata
        })
      expect(next).toEqual(previous)
    }
  })

  test('fetches changed source blobs and emits exact database buckets', async () => {
    const {source} = await createEntryIndex(cms.config, [
      {
        id: 'recipes',
        type: 'DemoRecipes',
        index: 'a1',
        path: 'recipes',
        data: {title: 'Recipes'}
      }
    ])
    const database = await SourceEntryDatabase.load(cms.config, source)
    const tree = await source.getTree()
    const path = 'pages/recipes.json'
    const leaf = tree.getLeaf(path)
    const [[, original]] = await Array.fromAsync(source.getBlobs([leaf.sha]))
    const record = JSON.parse(new TextDecoder().decode(original))
    record.title = 'Updated recipes'
    const contents = new TextEncoder().encode(JSON.stringify(record, null, 2))
    const sha = await hashBlob(contents)
    await source.applyChanges({
      fromSha: tree.sha,
      changes: [{op: 'add', path, sha, contents}]
    })

    const commit = await database.sync(source)
    expect(commit).toBeDefined()
    expect([...commit!.changes.records].sort()).toEqual(
      [
        `entry:${path}`,
        `entry-read:${path}`,
        `payload:${path}`,
        `search:explore:${path}`,
        `search:read:${path}`
      ].sort()
    )
    expect(commit!.changes.indexes).toEqual([
      {index: 'search.audience', key: 'explore'},
      {index: 'search.audience', key: 'read'}
    ])
    const [updated] = await new EntryQueryEngine(database.snapshot).find({
      id: 'recipes'
    })
    expect(updated.title).toBe('Updated recipes')
  })

  test('matches status preference and inherited parent status', async () => {
    const {source, index} = await createEntryIndex(cms.config, [
      {
        id: 'drafted',
        type: 'DemoRecipes',
        index: 'a1',
        path: 'drafted',
        status: 'published',
        data: {title: 'Published'}
      },
      {
        id: 'drafted',
        type: 'DemoRecipes',
        index: 'a1',
        path: 'drafted',
        status: 'draft',
        data: {title: 'Draft'}
      },
      {
        id: 'archived',
        type: 'DemoRecipes',
        index: 'a2',
        path: 'archived',
        status: 'archived',
        data: {title: 'Archived'}
      },
      {
        id: 'child',
        type: 'DemoRecipe',
        index: 'a1',
        parentPaths: ['archived'],
        path: 'child',
        status: 'published',
        data: {title: 'Child'}
      }
    ])
    const query = new EntryQueryEngine(
      await buildEntryDatabase(cms.config, source)
    )
    const statuses = [
      'published',
      'draft',
      'archived',
      'preferDraft',
      'preferPublished',
      'all'
    ] as const

    for (const status of statuses) {
      const expected = Array.from(index.filter({})).filter(entry => {
        switch (status) {
          case 'published':
          case 'draft':
          case 'archived':
            return entry.status === status
          case 'preferDraft':
            return entry.active
          case 'preferPublished':
            return entry.main
          case 'all':
            return true
        }
      })
      const current = await query.find({status})
      expect(
        current
          .map(entry => `${entry.entryId}:${entry.status}:${entry.title}`)
          .sort()
      ).toEqual(
        expected
          .map(entry => `${entry.id}:${entry.status}:${entry.title}`)
          .sort()
      )
    }
  })
})

interface ComparableEntry {
  id: string
  status: string
  title: string
  type: string
  parentId: string | null
  parents: ReadonlyArray<string>
  workspace: string
  root: string
  locale: string | null
  level: number
  index: string
  path: string
  url: string
}

function comparable(entry: {
  entryId: string
  status: string
  title: string
  type: string
  parentId: string | null
  parents: ReadonlyArray<string>
  workspace: string
  root: string
  locale: string | null
  level: number
  index: string
  path: string
  url: string
}): ComparableEntry {
  return {
    id: entry.entryId,
    status: entry.status,
    title: entry.title,
    type: entry.type,
    parentId: entry.parentId,
    parents: entry.parents,
    workspace: entry.workspace,
    root: entry.root,
    locale: entry.locale,
    level: entry.level,
    index: entry.index,
    path: entry.path,
    url: entry.url
  }
}

function compareComparable(left: ComparableEntry, right: ComparableEntry) {
  return `${left.id}:${left.locale}:${left.status}`.localeCompare(
    `${right.id}:${right.locale}:${right.status}`
  )
}
