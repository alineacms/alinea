import {describe, expect, test} from 'bun:test'
import {cms} from '#test/cms.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {FSSource} from '#/core/source/FSSource.js'
import {EntryQueryEngine} from './Query.js'
import {referencesBySource} from './Indexes.js'
import {SourceEntryDatabase, buildEntryDatabase} from './Source.js'

const fixtureDirectory = 'test/fixtures/demo'

describe('source entry database', () => {
  test('normalizes the current fixture into structural and reference records', async () => {
    const source = new FSSource(fixtureDirectory)
    const snapshot = await buildEntryDatabase(cms.config, source)
    const current = await new EntryQueryEngine(snapshot).find({
      status: 'all'
    })
    expect(current).not.toHaveLength(0)
    expect(new Set(current.map(entry => entry.id)).size).toBe(current.length)
    for (const entry of current) {
      expect(cms.config.schema[entry.type]).toBeDefined()
      expect(entry.parents.at(-1) ?? null).toBe(entry.parentId)
      for (const reference of snapshot.scan(
        referencesBySource,
        entry.entryId
      )) {
        expect(reference.metadata.sourceEntryId).toBe(entry.entryId)
        expect(reference.metadata.targetId).not.toBe('')
      }
    }
  })

  test('fetches changed source blobs and emits exact database buckets', async () => {
    const source = await createEntrySource(cms.config, [
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
    const source = await createEntrySource(cms.config, [
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
      const current = await query.find({status})
      expect(current.every(entry => matchesStatus(entry, status))).toBe(true)
    }
  })
})

function matchesStatus(
  entry: {status: string; active: boolean; main: boolean},
  status:
    | 'published'
    | 'draft'
    | 'archived'
    | 'preferDraft'
    | 'preferPublished'
    | 'all'
) {
  if (status === 'preferDraft') return entry.active
  if (status === 'preferPublished') return entry.main
  if (status === 'all') return true
  return entry.status === status
}
