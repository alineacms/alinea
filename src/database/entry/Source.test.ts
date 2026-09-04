import {describe, expect, test} from 'bun:test'
import {Entry} from '#/core/Entry.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {FSSource} from '#/core/source/FSSource.js'
import {cms} from '#test/cms.js'
import {createEntrySource, createRuntimeStore} from '#test/EntryFixture.js'
import {DatabaseResolver} from '../query/Resolver.js'
import {loadParsedVersions, normalizeParsedVersions} from './Source.js'

describe('source normalization', () => {
  test('produces runtime structural rows from the current fixture', async () => {
    const source = new FSSource('test/fixtures/demo')
    const parsed = await loadParsedVersions(cms.config, source)
    const current = normalizeParsedVersions(cms.config, parsed.versions)

    expect(current).not.toHaveLength(0)
    expect(new Set(current.map(item => item.core.id)).size).toBe(current.length)
    for (const {core} of current) {
      expect(
        cms.config.schema[core.type as keyof typeof cms.config.schema]
      ).toBeDefined()
      expect(core.parents.at(-1) ?? null).toBe(core.parentId)
    }
  })

  test('reads changed source bytes into the next normalization', async () => {
    const source = await createEntrySource(cms.config, [
      {
        id: 'recipes',
        type: 'DemoRecipes',
        index: 'a1',
        path: 'recipes',
        data: {title: 'Recipes'}
      }
    ])
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

    const parsed = await loadParsedVersions(cms.config, source)
    const [updated] = normalizeParsedVersions(cms.config, parsed.versions)
    expect(updated.core.title).toBe('Updated recipes')
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
    const store = await createRuntimeStore(cms.config, source)
    const resolver = new DatabaseResolver(cms.config, store)
    const statuses = [
      'published',
      'draft',
      'archived',
      'preferDraft',
      'preferPublished',
      'all'
    ] as const

    for (const status of statuses) {
      const current = await resolver.resolve({status, select: Entry})
      expect(current.every(entry => matchesStatus(entry, status))).toBe(true)
    }

    expect(
      store.index.entries.find(entry => entry.entryId === 'child')
    ).toMatchObject({
      versionStatus: 'published',
      status: 'archived'
    })
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
