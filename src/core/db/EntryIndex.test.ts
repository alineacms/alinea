import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import {cms} from '../../test/cms.js'
import {createEntryIndex} from '../../test/EntryFixture.js'
import {createRecord} from '../EntryRecord.js'
import {hashBlob} from '../source/GitUtils.js'
import {MemorySource} from '../source/MemorySource.js'
import {
  combineConditions,
  type EntryCondition,
  EntryGraph,
  EntryIndex
} from './EntryIndex.js'
import {IndexEvent} from './IndexEvent.js'

const test = suite(import.meta)

const fixtureEntries = [
  {
    id: 'recipes',
    type: 'DemoRecipes',
    index: 'a1',
    path: 'recipes',
    data: {title: 'Recipes'}
  },
  {
    id: 'cookie-1',
    type: 'DemoRecipe',
    index: 'a1',
    parentPaths: ['recipes'],
    path: 'cookie-1',
    data: {title: 'Cookie 1'}
  },
  {
    id: 'cookie-2',
    type: 'DemoRecipe',
    index: 'a2',
    parentPaths: ['recipes'],
    path: 'cookie-2',
    data: {title: 'Cookie 2'}
  }
]

test('combineConditions combines checks from both conditions', () => {
  const seen = {
    aNode: 0,
    bNode: 0,
    aLanguage: 0,
    bLanguage: 0,
    aEntry: 0,
    bEntry: 0
  }
  const a: EntryCondition = {
    search: 'from-a',
    nodes: [],
    node() {
      seen.aNode++
      return true
    },
    language() {
      seen.aLanguage++
      return true
    },
    entry() {
      seen.aEntry++
      return true
    }
  }
  const b: EntryCondition = {
    search: 'from-b',
    nodes: [undefined as any],
    node() {
      seen.bNode++
      return true
    },
    language() {
      seen.bLanguage++
      return true
    },
    entry() {
      seen.bEntry++
      return true
    }
  }
  const merged = combineConditions(a, b)
  test.is(merged.search, 'from-a')
  test.equal(merged.nodes, a.nodes)
  test.ok(merged.node!(undefined as any))
  test.ok(merged.language!(undefined as any))
  test.ok(merged.entry!(undefined as any))
  test.equal(seen, {
    aNode: 1,
    bNode: 1,
    aLanguage: 1,
    bLanguage: 1,
    aEntry: 1,
    bEntry: 1
  })
})

test('constructs empty entry graph', () => {
  const graph = new EntryGraph(cms.config, new Map(), new Map())
  test.is(graph.byId('missing'), undefined)
  test.is(graph.byDir('missing'), undefined)
  test.equal(Array.from(graph.filter({})), [])
})

test('indexes one-off fixture entries', async () => {
  const {index} = await createEntryIndex(cms.config, fixtureEntries)
  const all = Array.from(index.filter({}))
  test.is(all.length, 3)
  const parent = index.byId('recipes')
  test.ok(parent)
  const children = Array.from(parent!.children())
  test.equal(
    children.map(child => child.id),
    ['cookie-1', 'cookie-2']
  )
})

test('filters by entry predicate', async () => {
  const {index} = await createEntryIndex(cms.config, fixtureEntries)
  const recipes = Array.from(
    index.filter({
      entry(entry) {
        return entry.type === 'DemoRecipe'
      }
    })
  )
  test.equal(
    recipes.map(entry => entry.id),
    ['cookie-1', 'cookie-2']
  )
})

test('findFirst/findMany and status variants on language nodes', async () => {
  const {index} = await createEntryIndex(cms.config, [
    {
      id: 'recipes',
      type: 'DemoRecipes',
      index: 'a1',
      path: 'recipes',
      data: {title: 'Recipes'}
    },
    {
      id: 'cookie',
      type: 'DemoRecipe',
      index: 'a1',
      parentPaths: ['recipes'],
      path: 'cookie',
      status: 'published',
      data: {title: 'Cookie'}
    },
    {
      id: 'cookie',
      type: 'DemoRecipe',
      index: 'a1',
      parentPaths: ['recipes'],
      path: 'cookie',
      status: 'draft',
      data: {title: 'Cookie draft'}
    }
  ])
  const first = index.findFirst(entry => entry.id === 'cookie')
  test.ok(first)
  const many = Array.from(index.findMany(entry => entry.id === 'cookie'))
  test.is(many.length, 2)
  const node = index.byId('cookie')!
  const language = node.get(null)!
  test.ok(language.has('published'))
  test.ok(language.has('draft'))
  test.is(Array.from(language).length, 2)
})

test('search handles punctuation and diacritics', async () => {
  const {index} = await createEntryIndex(cms.config, [
    {
      id: 'recipe-cafe',
      type: 'DemoRecipe',
      index: 'a1',
      path: 'cafe',
      data: {title: 'Cafe', intro: [{_type: 'paragraph', content: []}]}
    }
  ])
  const found = Array.from(index.filter({search: 'Café'}))
  test.is(found.length, 1)
  test.is(found[0].id, 'recipe-cafe')
})

test('syncWith and indexChanges dispatch entry/index events', async () => {
  const {index, source} = await createEntryIndex(cms.config, fixtureEntries)
  const emitted = Array<{op: string; value: string}>()
  index.addEventListener(IndexEvent.type, event => {
    const indexEvent = event as IndexEvent
    if (indexEvent.data.op === 'entry')
      emitted.push({op: 'entry', value: indexEvent.data.id})
    if (indexEvent.data.op === 'index')
      emitted.push({op: 'index', value: indexEvent.data.sha})
  })

  const from = await source.getTree()
  const removePath = 'pages/recipes/cookie-2.json'
  const leaf = from.getLeaf(removePath)
  const addRecord = createRecord(
    {
      id: 'cookie-3',
      type: 'DemoRecipe',
      index: 'a3',
      parentId: 'recipes',
      root: 'pages',
      path: 'cookie-3',
      title: 'Cookie 3',
      seeded: null,
      data: {path: 'cookie-3', title: 'Cookie 3'}
    },
    'published'
  )
  const addContents = new TextEncoder().encode(
    JSON.stringify(addRecord, null, 2)
  )
  const addSha = await hashBlob(addContents)
  await source.applyChanges({
    fromSha: from.sha,
    changes: [
      {op: 'delete', path: removePath, sha: leaf.sha},
      {
        op: 'add',
        path: 'pages/recipes/cookie-3.json',
        sha: addSha,
        contents: addContents
      }
    ]
  })
  const changedSha = await index.syncWith(source)
  test.is(index.sha, changedSha)
  test.ok(
    emitted.some(event => event.op === 'entry' && event.value === 'cookie-2')
  )
  test.ok(
    emitted.some(event => event.op === 'entry' && event.value === 'cookie-3')
  )
  test.ok(
    emitted.some(event => event.op === 'index' && event.value === changedSha)
  )

  const noChangeSha = await index.syncWith(source)
  test.is(noChangeSha, changedSha)
  test.is(
    await index.indexChanges({fromSha: index.sha, changes: []}),
    index.sha
  )
  await test.throws(
    () => index.indexChanges({fromSha: 'invalid-sha', changes: []}),
    'SHA mismatch'
  )
})

test('seed creates missing seeded entries and reuses i18n ids', async () => {
  const Page = Config.document('Page', {
    fields: {title: Field.text('Title')}
  })
  const main = Config.workspace('Main', {
    source: 'content/main',
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
  const seededCms = createCMS({schema: {Page}, workspaces: {main}})
  const source = new MemorySource()
  const index = new EntryIndex(seededCms.config)

  await index.syncWith(source)
  await index.seed(source)

  const seeded = Array.from(index.filter({}))
  test.is(seeded.length, 4)
  const homeEntries = seeded.filter(entry => entry.path === 'home')
  test.is(homeEntries.length, 2)
  test.is(homeEntries[0].id, homeEntries[1].id)

  await index.seed(source)
  test.is(Array.from(index.filter({})).length, 4)
})

test('fix rewrites changed blobs and transaction can be created', async () => {
  const {index, source} = await createEntryIndex(cms.config, fixtureEntries)
  const [entry] = Array.from(
    index.filter({entry: entry => entry.id === 'cookie-1'})
  )
  const badRecord = createRecord(
    {
      ...entry,
      data: {...entry.data, title: 'Changed outside index'}
    },
    entry.status
  )
  const badContents = new TextEncoder().encode(
    JSON.stringify(badRecord, null, 2)
  )
  const badSha = await hashBlob(badContents)
  const tree = await source.getTree()
  await source.applyChanges({
    fromSha: tree.sha,
    changes: [
      {
        op: 'add',
        path: entry.filePath,
        sha: badSha,
        contents: badContents
      }
    ]
  })

  const changedTree = await source.getTree()
  ;(changedTree as any).sha = index.sha
  await index.fix(source)
  const tx = await index.transaction(source)
  test.ok(tx)

  const expectedRecord = createRecord(entry, entry.status)
  const expectedContents = new TextEncoder().encode(
    JSON.stringify(expectedRecord, null, 2)
  )
  const expectedSha = await hashBlob(expectedContents)
  const after = await source.getTree()
  test.is(after.getLeaf(entry.filePath).sha, expectedSha)

  await index.fix(source)
})
