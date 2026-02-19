import {suite} from '@alinea/suite'
import {Config, Field, Query} from 'alinea'
import {createCMS, Entry} from 'alinea/core'
import {MediaFile} from 'alinea/core/media/MediaTypes'
import {cms} from '../../test/cms.js'
import {createEntryResolver} from '../../test/EntryFixture.js'
import {DemoRecipe} from '../../test/schema/DemoRecipe.js'
import {DemoRecipes} from '../../test/schema/DemoRecipes.js'
import {Expr} from '../Expr.js'
import type {GraphQuery} from '../Graph.js'
import {FSSource} from '../source/FSSource.js'
import {EntryIndex} from './EntryIndex.js'
import {EntryResolver, statusChecker} from './EntryResolver.js'

const test = suite(import.meta)

const dir = 'src/test/fixtures/demo'
const source = new FSSource(dir)

const index = new EntryIndex(cms.config)
const resolver = new EntryResolver(cms.config, index)
await index.syncWith(source)

test('filter by id', async () => {
  console.time('filter by id')
  const entry2 = await resolver.resolve({
    id: 'oi4qtV9YaXNRIUDT2s61Y'
  })
  console.timeEnd('filter by id')
  test.is(entry2.length, 1)
})

test('filter by type', async () => {
  const files = await resolver.resolve({
    type: MediaFile
  })
  test.is(files.length, 5)
})

test('filter by location', async () => {
  const files = await resolver.resolve({
    location: cms.workspaces.demo.media
  })
  test.is(files.length, 5)

  const inWorkspace = await resolver.resolve({
    location: cms.workspaces.demo
  })
  test.is(inWorkspace.length, 11)
})

test('filter by language', async () => {
  const entries = await resolver.resolve({
    locale: 'en'
  })
  test.is(entries.length, 0)
})

test('select fields', async () => {
  const [recipe1] = await resolver.resolve({
    type: DemoRecipe,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: {
      title_: DemoRecipe.title,
      intro: DemoRecipe.intro,
      id: Entry.id
    }
  })
  test.is(recipe1.title_, 'Chocolate chip')
  test.is(recipe1.id, 'oi4qtV9YaXNRIUDT2s61Y')
  test.ok(recipe1.intro)
})

test('select edges', async () => {
  const [recipes] = await resolver.resolve({
    type: DemoRecipes,
    select: Query.children({
      select: DemoRecipe.header
    })
  })
  test.is(recipes.length, 4)
  for (const header of recipes) {
    test.ok(header.image.src)
  }
})

test('select siblings', async () => {
  const siblings = await resolver.resolve({
    first: true,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Query.siblings({
      select: Query.id
    })
  })
  test.is(siblings!.length, 3)
})

test('select next', async () => {
  const nextId = await resolver.resolve({
    first: true,
    id: 'oU_7ZAszAXwar__BCXVIt',
    select: Query.next({
      select: Query.id
    })
  })
  test.is(nextId, 'uENumuMjqX0fSbGtrf2fj')
})

test('select next', async () => {
  const nextId = await resolver.resolve({
    first: true,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Query.next({
      select: Query.id
    })
  })
  test.is(nextId, undefined)
})

test('select previous', async () => {
  const previousId = await resolver.resolve({
    first: true,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Query.previous({
      select: Query.id
    })
  })
  test.is(previousId, 'uENumuMjqX0fSbGtrf2fj')
})

test('select parent', async () => {
  const id1 = await resolver.resolve({
    first: true,
    type: DemoRecipe,
    select: Entry.parentId
  })
  const id2 = await resolver.resolve({
    first: true,
    type: DemoRecipe,
    select: Query.parent({
      select: Entry.id
    })
  })
  test.is(id1, id2)
})

test('order by', async () => {
  const first = await resolver.resolve({
    type: DemoRecipe,
    select: DemoRecipe.title,
    orderBy: {asc: DemoRecipe.title},
    first: true
  })
  test.is(first, 'Chocolate chip')

  const last = await resolver.resolve({
    type: DemoRecipe,
    select: DemoRecipe.title,
    orderBy: {desc: DemoRecipe.title},
    first: true
  })
  test.is(last, 'Snickerdoodle')
})

test('group by', async () => {
  const files = await resolver.resolve({
    type: MediaFile,
    groupBy: MediaFile.extension
  })
  test.is(files.length, 1)
})

test('preview existing entry', async () => {
  const entry = await resolver.resolve({
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Entry,
    first: true
  })
  test.is(entry!.title, 'Chocolate chip')

  const entry2 = await resolver.resolve({
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Entry,
    first: true,
    preview: {
      entry: {
        ...entry!,
        fileHash: 'preview',
        data: {...entry?.data, title: 'Chocolate chip preview'}
      }
    }
  })
  test.is(entry2!.title, 'Chocolate chip preview')
})

const Article = Config.document('Article', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    score: Field.number('Score'),
    text: Field.text('Text'),
    single: Field.entry('Single'),
    multi: Field.entry.multiple('Multi'),
    meta: Field.object('Meta', {
      fields: {inner: Field.text('Inner')}
    }),
    tags: Field.list('Tags', {
      schema: {
        tag: Config.type('Tag', {
          fields: {itemId: Field.text('Item id')}
        })
      }
    })
  }
})

const mainWorkspace = Config.workspace('Main', {
  source: 'content/main',
  roots: {
    pages: Config.root('Pages', {
      contains: ['Article']
    }),
    localized: Config.root('Localized', {
      i18n: {locales: ['en', 'de']},
      contains: ['Article']
    })
  }
})

const advancedCms = createCMS({
  schema: {Article},
  workspaces: {main: mainWorkspace}
})

const advancedEntries = [
  {
    id: 'parent',
    type: 'Article',
    index: 'a1',
    path: 'parent',
    data: {title: 'Parent', score: 10, text: 'top level'}
  },
  {
    id: 'child-1',
    type: 'Article',
    index: 'a1',
    parentPaths: ['parent'],
    path: 'alpha',
    data: {
      title: 'Alpha',
      score: 5,
      text: 'one two cookie four five',
      single: {_entry: 'child-2'},
      multi: [{_entry: 'child-2'}, {_entry: 'missing'}],
      meta: {inner: 'x'},
      tags: [{itemId: 'a'}, {itemId: 'b'}]
    }
  },
  {
    id: 'child-2',
    type: 'Article',
    index: 'a2',
    parentPaths: ['parent'],
    path: 'beta',
    data: {
      title: 'beta',
      score: 8,
      text: 'beta text',
      meta: {inner: 'y'},
      tags: [{itemId: 'c'}]
    }
  },
  {
    id: 'grand',
    type: 'Article',
    index: 'a3',
    parentPaths: ['parent', 'alpha'],
    path: 'grand',
    data: {title: 'Grand', score: 2, text: 'grand text'}
  },
  {
    id: 'trans',
    type: 'Article',
    index: 'a1',
    root: 'localized',
    locale: 'en',
    path: 'trans',
    data: {title: 'Trans EN', score: 1, text: 'trans en'}
  },
  {
    id: 'trans',
    type: 'Article',
    index: 'a1',
    root: 'localized',
    locale: 'de',
    path: 'trans',
    data: {title: 'Trans DE', score: 1, text: 'trans de'}
  }
]

async function createAdvancedResolver() {
  return createEntryResolver(advancedCms.config, advancedEntries)
}

function valueExpr(value: unknown) {
  return new Expr({type: 'value', value})
}

function snippetCall(
  start: string,
  end: string,
  cutOff: string,
  limit: number
) {
  return {
    method: 'snippet',
    args: [
      valueExpr(start),
      valueExpr(end),
      valueExpr(cutOff),
      valueExpr(limit)
    ]
  }
}

function findEntryById(index: EntryIndex, id: string) {
  const [entry] = Array.from(index.filter({entry: entry => entry.id === id}))
  test.ok(entry)
  return entry
}

function publishedCtx(index: EntryIndex, searchTerms?: string) {
  return {
    status: 'published' as const,
    locale: null,
    graph: index.graph,
    searchTerms
  }
}

test('statusChecker covers all status modes', async () => {
  const {index} = await createAdvancedResolver()
  const entry = findEntryById(index, 'child-1')
  test.is(statusChecker('published')(entry), true)
  test.is(statusChecker('draft')(entry), false)
  test.is(statusChecker('archived')(entry), false)
  test.is(statusChecker('preferDraft')(entry), entry.active)
  test.is(statusChecker('preferPublished')(entry), entry.main)
  test.is(statusChecker('all')(entry), true)
})

test('filter operators and id in queries', async () => {
  const {resolver} = await createAdvancedResolver()
  const rows = await resolver.resolve({
    type: Article,
    id: {in: ['child-1', 'child-2', 'missing']},
    filter: {
      score: {
        is: 5,
        isNot: 7,
        in: [5, 9],
        notIn: [1, 2],
        gt: 4,
        gte: 5,
        lt: 6,
        lte: 5
      },
      title: {startsWith: 'Al', or: [{title: 'Nope'}, {title: 'Alpha'}]},
      meta: {has: {inner: {is: 'x'}}},
      tags: {includes: {itemId: {is: 'a'}}}
    },
    select: Query.id
  } as GraphQuery)
  test.equal(rows, ['child-1'])

  const orRows = await resolver.resolve({
    type: Article,
    filter: {or: [{title: 'Alpha'}, {title: 'beta'}]} as any,
    select: Query.id
  })
  test.equal(orRows, ['child-1', 'child-2'])

  const andRows = await resolver.resolve({
    type: Article,
    filter: {and: [{title: 'Alpha'}, {score: {is: 5}}]} as any,
    select: Query.id
  })
  test.equal(andRows, ['child-1'])
})

test('snippet supports highlight, no matches and validation errors', async () => {
  const {resolver, index} = await createAdvancedResolver()
  const entry = findEntryById(index, 'child-1')
  const snippetEntry = {...entry, searchableText: 'one two cookie four five'}
  const highlighted = resolver.call(
    publishedCtx(index, 'cookie'),
    snippetEntry,
    snippetCall('[', ']', '...', 3)
  ) as string
  test.ok(highlighted.includes('['))
  test.ok(highlighted.includes(']'))
  test.ok(highlighted.startsWith('...'))
  test.ok(highlighted.endsWith('...'))

  const noMatch = resolver.call(
    publishedCtx(index, 'nomatch'),
    snippetEntry,
    snippetCall('<', '>', '...', 2)
  ) as string
  test.is(noMatch, 'one two')

  await test.throws(
    () =>
      resolver.call(
        publishedCtx(index, 'cookie'),
        snippetEntry,
        snippetCall('<', '>', '...', 0)
      ),
    "The 'limit' parameter must be greater than zero"
  )

  await test.throws(
    () =>
      resolver.call(publishedCtx(index), entry, {
        method: 'snippet',
        args: []
      }),
    'Snippet method requires search terms'
  )
  await test.throws(
    () =>
      resolver.call(publishedCtx(index, 'cookie'), entry, {
        method: 'unknown',
        args: []
      }),
    'Unknown method'
  )
})

test('resolver helpers and edge branches', async () => {
  const {resolver, index} = await createAdvancedResolver()
  const entry = findEntryById(index, 'child-1')
  const ctx = publishedCtx(index)
  test.is(resolver.select(ctx, null, {} as any), null)
  await test.throws(
    () => resolver.field(entry, valueExpr(1) as any),
    'Expression has no name'
  )
  test.equal(resolver.sourceFilter(ctx, entry, {edge: 'unknown'} as any), {})
  await resolver.postExpr({linkResolver: {} as any}, {}, valueExpr(1) as any)
  await resolver.postRow({linkResolver: {} as any}, null, {} as any)
  await resolver.post({linkResolver: {} as any}, [], {
    edge: 'children',
    count: true
  } as any)
})

test('paging, numeric ordering, parents sorting and location filters', async () => {
  const {resolver} = await createAdvancedResolver()
  const ordered = await resolver.resolve({
    type: Article,
    id: {in: ['child-1', 'child-2', 'grand']},
    orderBy: {asc: Article.score},
    select: Query.id
  })
  test.equal(ordered, ['grand', 'child-1', 'child-2'])

  const paged = await resolver.resolve({
    type: Article,
    id: {in: ['child-1', 'child-2', 'grand']},
    orderBy: {asc: Article.score},
    skip: 1,
    take: 1,
    select: Query.id
  })
  test.equal(paged, ['child-1'])

  const parents = await resolver.resolve({
    first: true,
    id: 'grand',
    select: Query.parents({select: Query.id})
  })
  test.equal(parents, ['parent', 'child-1'])

  const level1 = await resolver.resolve({
    location: ['main', 'pages', 'parent'],
    select: Query.id
  })
  test.equal(level1, ['child-1', 'child-2', 'grand'])

  const level2 = await resolver.resolve({
    location: ['main', 'pages', 'alpha'],
    select: Query.id
  })
  test.equal(level2, [])
})

test('locales, translations and link edges', async () => {
  const {resolver} = await createAdvancedResolver()
  const preferred = await resolver.resolve({
    type: Article,
    preferredLocale: 'en',
    root: mainWorkspace.pages,
    select: Query.id
  })
  test.ok(preferred.includes('parent'))

  const translated = await resolver.resolve({
    first: true,
    locale: 'en',
    root: mainWorkspace.localized,
    id: 'trans',
    select: Query.translations({select: Query.locale})
  })
  test.equal(translated, ['de'])

  const linkedSingle = await resolver.resolve({
    first: true,
    id: 'child-1',
    select: Article.single.first({select: Query.id})
  })
  test.is(linkedSingle, 'child-2')

  const linkedMany = await resolver.resolve({
    first: true,
    id: 'child-1',
    select: Article.multi.find({select: Query.id})
  })
  test.equal(linkedMany, ['child-2'])
})

test('query mode helpers and groupBy validation', async () => {
  const {resolver, index} = await createAdvancedResolver()
  const count = await resolver.resolve({
    type: Article,
    root: mainWorkspace.pages,
    count: true
  })
  test.is(count, 4)

  await test.throws(
    () =>
      resolver.resolve({
        type: Article,
        groupBy: [Article.title]
      }),
    'groupBy must be a single field'
  )

  const ctx = publishedCtx(index)
  const direct = resolver.query(ctx, {
    type: Article,
    root: mainWorkspace.pages,
    select: Query.id,
    first: true
  })
  test.ok(direct.entries.length > 0)
  test.ok(await direct.getProcessed())
})

test('direct condition and helper branches', async () => {
  const {resolver, index} = await createAdvancedResolver()
  const ctx = publishedCtx(index)
  const entry = findEntryById(index, 'child-1')
  const directFilter = resolver.condition(ctx, {
    location: ['main', 'pages', 'parent', 'ignored'],
    filter: {_id: {is: 'child-1'}}
  } as any)
  test.ok(directFilter.condition?.(entry))

  test.is(resolver.isSingleResult({} as any), false)
  await resolver.post({linkResolver: {} as any}, [], {
    edge: 'siblings',
    select: Query.id
  } as any)
})
