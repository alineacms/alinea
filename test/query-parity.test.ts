import {cms} from '#test/cms.js'
import {createEntrySource} from '#test/EntryFixture.js'
import {DemoRecipe} from '#test/schema/DemoRecipe.js'
import {DemoRecipes} from '#test/schema/DemoRecipes.js'
import {afterAll, beforeAll, expect, test} from 'bun:test'
import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import type {Condition} from '#/core/Filter.js'
import {ListRow} from '#/core/ListRow.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {getScope} from '#/core/Scope.js'
import {FSSource} from '#/core/source/FSSource.js'
import {Node} from '#/core/TextDoc.js'
import {Config, Field, Query} from '#/index.js'

const source = new FSSource('test/fixtures/demo')
const db = new LocalDB(cms.config)

beforeAll(async () => {
  await db.syncWith(source)
})

afterAll(async () => {
  await db.close()
})

test('filters by id', async () => {
  const entries = await db.find({id: 'oi4qtV9YaXNRIUDT2s61Y'})
  expect(entries).toHaveLength(1)
})

test('filters by type', async () => {
  const files = await db.find({type: MediaFile})
  expect(files).toHaveLength(5)
})

test('filters by location', async () => {
  const files = await db.find({location: cms.workspaces.demo.media})
  expect(files).toHaveLength(5)

  const inWorkspace = await db.find({location: cms.workspaces.demo})
  expect(inWorkspace).toHaveLength(11)
})

test('filters by locale', async () => {
  const entries = await db.find({locale: 'en'})
  expect(entries).toHaveLength(0)
})

test('selects fields', async () => {
  const [recipe] = await db.find({
    type: DemoRecipe,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: {
      title_: DemoRecipe.title,
      intro: DemoRecipe.intro,
      id: Entry.id
    }
  })

  expect(recipe?.title_).toBe('Chocolate chip')
  expect(recipe?.id).toBe('oi4qtV9YaXNRIUDT2s61Y')
  expect(recipe?.intro).toBeTruthy()
})

test('selects children', async () => {
  const recipes = await db.get({
    type: DemoRecipes,
    select: Query.children({select: DemoRecipe.header})
  })

  expect(recipes).toHaveLength(4)
  for (const header of recipes) expect(header.image?.src).toBeTruthy()
})

test('selects siblings', async () => {
  const siblings = await db.get({
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Query.siblings({select: Entry.id})
  })
  expect(siblings).toHaveLength(3)
})

test('selects next', async () => {
  const nextId = await db.resolve({
    first: true,
    id: 'oU_7ZAszAXwar__BCXVIt',
    select: Query.next({select: Entry.id})
  })
  expect(nextId).toBe('uENumuMjqX0fSbGtrf2fj')
})

test('returns undefined when there is no next entry', async () => {
  const nextId = await db.resolve({
    first: true,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Query.next({select: Entry.id})
  })
  expect(nextId).toBeUndefined()
})

test('selects previous', async () => {
  const previousId = await db.resolve({
    first: true,
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Query.previous({select: Entry.id})
  })
  expect(previousId).toBe('uENumuMjqX0fSbGtrf2fj')
})

test('selects parent', async () => {
  const parentId = await db.first({
    type: DemoRecipe,
    select: Entry.parentId
  })
  const selectedParentId = await db.first({
    type: DemoRecipe,
    select: Query.parent({select: Entry.id})
  })
  expect(selectedParentId).toBe(parentId)
})

test('orders ascending and descending', async () => {
  const first = await db.first({
    type: DemoRecipe,
    select: DemoRecipe.title,
    orderBy: {asc: DemoRecipe.title}
  })
  expect(first).toBe('Chocolate chip')

  const last = await db.first({
    type: DemoRecipe,
    select: DemoRecipe.title,
    orderBy: {desc: DemoRecipe.title}
  })
  expect(last).toBe('Snickerdoodle')
})

test('groups results', async () => {
  const files = await db.find({
    type: MediaFile,
    groupBy: MediaFile.extension
  })
  expect(files).toHaveLength(1)
})

test('previews an existing entry', async () => {
  const entry = await db.get({
    id: 'oi4qtV9YaXNRIUDT2s61Y',
    select: Entry
  })
  expect(entry.title).toBe('Chocolate chip')

  const preview = await db.get({
    id: entry.id,
    select: Entry,
    preview: {
      entry: {
        ...entry,
        fileHash: '0000000000000000000000000000000000000000',
        data: {...entry.data, title: 'Chocolate chip preview'}
      }
    }
  })
  expect(preview.title).toBe('Chocolate chip preview')
})

const Article = Config.document('Article', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    score: Field.number('Score'),
    spotlight: Field.check('Spotlight'),
    text: Field.text('Text'),
    single: Field.entry('Single'),
    multi: Field.entry.multiple('Multi'),
    body: Field.richText('Body'),
    heroImage: Field.image('Hero image'),
    gallery: Field.image.multiple('Gallery'),
    meta: Field.object('Meta', {fields: {inner: Field.text('Inner')}}),
    tags: Field.list('Tags', {
      schema: {
        tag: Config.type('Tag', {fields: {itemId: Field.text('Item id')}})
      }
    })
  }
})

const mainWorkspace = Config.workspace('Main', {
  source: 'content/main',
  roots: {
    pages: Config.root('Pages', {contains: ['Article']}),
    localized: Config.root('Localized', {
      i18n: {locales: ['en', 'de']},
      contains: ['Article']
    }),
    media: Config.media({
      i18n: {
        locales: ['en', 'de', 'fr'],
        fallback(requested) {
          return requested === 'de' ? ['fr', 'en'] : ['en']
        }
      }
    })
  }
})

const advancedCms = createCMS({
  schema: {Article},
  workspaces: {main: mainWorkspace}
})

const link = (entry: string, id: string) => ({
  _id: id,
  _type: 'entry',
  _entry: entry
})

const advancedEntries = [
  {
    id: 'parent',
    type: 'Article',
    index: 'a1',
    path: 'parent',
    data: {title: 'Parent', score: 10, spotlight: true, text: 'top level'}
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
      spotlight: false,
      text: 'one two cookie four five',
      single: {
        ...link('child-2', 'single-link'),
        _anchor: 'details',
        _suffix: '?filter=active'
      },
      multi: [link('child-2', 'multi-1'), link('parent', 'multi-2')],
      body: [
        {
          _type: 'paragraph',
          content: [
            {
              _type: 'text',
              text: 'Filtered child',
              marks: [
                {
                  _type: 'link',
                  _id: 'body-link',
                  _link: 'entry',
                  _entry: 'child-2',
                  _anchor: 'details',
                  _suffix: '?filter=active'
                }
              ]
            }
          ]
        }
      ],
      heroImage: {_type: 'image', _id: 'image-link-1', _entry: 'image-plain'},
      gallery: [
        {
          [ListRow.id]: 'image-row-1',
          [ListRow.index]: 'a0',
          [ListRow.type]: 'image',
          _entry: 'image-plain'
        }
      ],
      meta: {inner: 'x'},
      metadata: {
        aliases: [
          {
            [ListRow.id]: 'alias-1',
            [ListRow.index]: 'a0',
            [ListRow.type]: 'alias',
            url: '/old-alpha'
          }
        ],
        createdAt: 100,
        updatedAt: 200
      },
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
      spotlight: true,
      text: 'beta text',
      meta: {inner: 'y'},
      metadata: {
        aliases: [
          {
            [ListRow.id]: 'alias-2',
            [ListRow.index]: 'a0',
            [ListRow.type]: 'alias',
            url: '/old-beta'
          }
        ],
        createdAt: 300,
        updatedAt: 400
      },
      tags: [{itemId: 'c'}]
    }
  },
  {
    id: 'grand',
    type: 'Article',
    index: 'a3',
    parentPaths: ['parent', 'alpha'],
    path: 'grand',
    data: {
      title: 'Grand',
      score: 2,
      text: 'grand text',
      tags: null,
      metadata: {createdAt: null}
    }
  },
  {
    id: 'trans',
    type: 'Article',
    index: 'a1',
    root: 'localized',
    locale: 'en',
    path: 'trans',
    data: {
      title: 'Trans EN',
      score: 1,
      text: 'trans en',
      heroImage: {_type: 'image', _id: 'image-link-2', _entry: 'image-i18n'},
      single: link('parent', 'localized-single-link'),
      multi: [link('parent', 'localized-multi-link')]
    }
  },
  {
    id: 'trans',
    type: 'Article',
    index: 'a1',
    root: 'localized',
    locale: 'de',
    path: 'trans',
    data: {
      title: 'Trans DE',
      score: 1,
      text: 'trans de',
      heroImage: {_type: 'image', _id: 'image-link-2', _entry: 'image-i18n'}
    }
  },
  {
    id: 'image-plain',
    type: 'MediaFile',
    index: 'm1',
    root: 'media',
    path: 'plain-image',
    data: {
      title: 'Plain image',
      location: '/plain.jpg',
      previewUrl: '/preview/plain.jpg',
      extension: '.jpg',
      size: 12,
      hash: 'plain-hash',
      alt: 'Plain image alt',
      width: 100,
      height: 80,
      averageColor: '#fff',
      focus: {x: 0.5, y: 0.5},
      thumbHash: 'plain-thumb'
    }
  },
  {
    id: 'image-i18n',
    type: 'MediaFile',
    index: 'm2',
    root: 'media',
    path: 'i18n-image',
    data: {
      title: 'I18n image',
      location: '/i18n.jpg',
      previewUrl: '/preview/i18n.jpg',
      extension: '.jpg',
      size: 24,
      hash: 'i18n-hash',
      alt: {en: 'English image alt', fr: 'Texte alternatif francais'},
      width: 120,
      height: 90,
      averageColor: '#000',
      focus: {x: 0.25, y: 0.75},
      thumbHash: 'i18n-thumb'
    }
  }
]

async function withAdvancedStore<T>(run: (store: LocalDB) => Promise<T>) {
  const store = new LocalDB(advancedCms.config)
  const source = await createEntrySource(advancedCms.config, advancedEntries)
  try {
    await store.syncWith(source)
    return await run(store)
  } finally {
    await store.close()
  }
}

test('selects children by depth', async () => {
  await withAdvancedStore(async store => {
    async function children(depth: number) {
      return store.get({
        id: 'parent',
        select: Query.children({depth, select: Entry.id})
      })
    }
    expect(await children(0)).toEqual([])
    expect(await children(1.5)).toEqual(['child-1', 'child-2'])
    expect(await children(2)).toEqual(['child-1', 'child-2', 'grand'])
  })
})

test('projects and filters metadata shortcuts', async () => {
  await withAdvancedStore(async store => {
    const metadata = await store.get({
      id: 'child-1',
      select: {
        aliases: Entry.aliases,
        createdAt: Entry.createdAt,
        updatedAt: Entry.updatedAt
      }
    })
    expect(metadata.aliases as Array<unknown>).toEqual([
      {
        [ListRow.id]: 'alias-1',
        [ListRow.index]: 'a0',
        [ListRow.type]: 'alias',
        url: '/old-alpha'
      }
    ])
    expect(metadata.createdAt).toBe(100)
    expect(metadata.updatedAt).toBe(200)
    expect(await store.find({alias: '/old-beta', select: Entry.id})).toEqual([
      'child-2'
    ])
    expect(
      await store.find({
        filter: {_createdAt: 100, _updatedAt: 200},
        select: Entry.id
      })
    ).toEqual(['child-1'])

    const cases: Array<[Condition<string>, Array<string>]> = [
      [{is: '/old-beta'}, ['child-2']],
      [{in: ['/old-alpha', '/old-beta']}, ['child-1', 'child-2']],
      [{isNot: '/old-beta'}, ['child-1']],
      [{notIn: ['/old-alpha']}, ['child-2']],
      [{gte: '/old-alpha', lt: '/old-gamma'}, ['child-1', 'child-2']],
      [{startsWith: '/missing'}, []],
      [{in: []}, []]
    ]
    for (const [alias, expected] of cases)
      expect((await store.find({alias, select: Entry.id})).sort()).toEqual(
        expected
      )
  })
})

test('supports all filter operators through Graph.resolve', async () => {
  await withAdvancedStore(async store => {
    const rows = await store.find({
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
        title: {startsWith: 'Al', or: [{is: 'Nope'}, {is: 'Alpha'}]},
        meta: {has: {inner: {is: 'x'}}},
        tags: {includes: {itemId: {is: 'a'}}}
      },
      select: Entry.id
    })
    expect(rows).toEqual(['child-1'])
    expect(
      await store.find({
        type: Article,
        filter: {or: [{title: 'Alpha'}, {title: 'beta'}]},
        select: Entry.id
      })
    ).toEqual(['child-1', 'child-2'])
    expect(
      await store.find({
        type: Article,
        filter: {and: [{title: 'Alpha'}, {score: {is: 5}}]},
        select: Entry.id
      })
    ).toEqual(['child-1'])
  })
})

test('preserves paging, ordering, grouping and location behavior', async () => {
  await withAdvancedStore(async store => {
    const ids = ['parent', 'child-1', 'child-2', 'grand']
    expect(
      await store.find({type: Article, id: {in: ids}, select: Entry.id})
    ).toEqual(['parent', 'child-1', 'child-2', 'grand'])
    expect(
      await store.find({
        type: Article,
        id: {in: ids},
        skip: 1,
        take: 2,
        select: Entry.id
      })
    ).toEqual(['child-1', 'child-2'])
    expect(
      await store.find({
        type: Article,
        id: {in: ids},
        orderBy: {asc: Article.score},
        select: Entry.id
      })
    ).toEqual(['grand', 'child-1', 'child-2', 'parent'])
    expect(
      await store.find({
        type: Article,
        id: {in: ids},
        orderBy: {asc: Article.score},
        skip: 1,
        take: 1,
        select: Entry.id
      })
    ).toEqual(['child-1'])
    expect(
      await store.find({
        type: Article,
        id: {in: ids},
        orderBy: [
          {desc: Article.spotlight},
          {asc: Article.title, caseSensitive: true}
        ],
        select: Entry.id
      })
    ).toEqual(['parent', 'child-2', 'child-1', 'grand'])
    expect(
      await store.find({
        type: Article,
        id: {in: ids},
        orderBy: {asc: Article.title},
        select: Entry.id
      })
    ).toEqual(['child-1', 'child-2', 'grand', 'parent'])
    expect(
      await store.get({
        id: 'grand',
        select: Query.parents({select: Entry.id})
      })
    ).toEqual(['parent', 'child-1'])
    expect(
      await store.find({
        location: ['main', 'pages', 'parent'],
        select: Entry.id
      })
    ).toEqual(['child-1', 'child-2', 'grand'])
    expect(await store.count({type: Article, root: mainWorkspace.pages})).toBe(
      4
    )
    await expect(
      store.find({type: Article, groupBy: [Article.title]})
    ).rejects.toThrow('groupBy must be a single field')
    await expect(
      store.find({
        type: Article,
        // @ts-expect-error An order clause must specify one direction.
        orderBy: {asc: Article.title, desc: Article.spotlight}
      })
    ).rejects.toThrow('orderBy must specify exactly one direction')
  })
})

test('preserves missing, null and nested field projections', async () => {
  await withAdvancedStore(async store => {
    expect(
      await store.resolve({id: 'parent', first: true, select: Article.tags})
    ).toBeUndefined()
    expect(
      await store.resolve({id: 'grand', first: true, select: Article.tags})
    ).toBeNull()
    expect(
      await store.get({id: 'parent', select: {tags: Article.tags}})
    ).toEqual({tags: []})
    expect(
      await store.get({id: 'grand', select: {tags: Article.tags}})
    ).toEqual({tags: []})
    expect(
      await store.resolve({id: 'parent', first: true, select: Entry.createdAt})
    ).toBeUndefined()
    expect(
      await store.resolve({id: 'grand', first: true, select: Entry.createdAt})
    ).toBeNull()
    expect(
      await store.get({id: 'parent', select: {createdAt: Entry.createdAt}})
    ).toEqual({createdAt: undefined})
  })
})

test('preserves locale, translation and entry-link behavior', async () => {
  await withAdvancedStore(async store => {
    expect(
      await store.find({
        type: Article,
        preferredLocale: 'en',
        root: mainWorkspace.pages,
        select: Entry.id
      })
    ).toContain('parent')
    expect(
      await store.get({
        locale: 'en',
        root: mainWorkspace.localized,
        id: 'trans',
        select: Query.translations({select: Entry.locale})
      })
    ).toEqual(['de'])
    expect(
      await store.get({
        id: 'child-1',
        select: Article.single.first({select: Entry.id})
      })
    ).toBe('child-2')
    expect(
      await store.get({
        id: 'child-1',
        select: Article.multi.find({type: Article, select: Entry.id})
      })
    ).toEqual(['child-2', 'parent'])

    const query = {
      first: true,
      id: 'trans',
      locale: 'en',
      select: {single: Article.single, multiple: Article.multi}
    } as const
    const scope = getScope(advancedCms.config)
    const roundTripped = scope.parse<typeof query>(scope.stringify(query))
    const links = await store.resolve(roundTripped)
    expect(links?.single.entryId).toBe('parent')
    expect(links?.single.title).toBe('Parent')
    expect(links?.multiple[0]?.entryId).toBe('parent')
    expect(links?.multiple[0]?.title).toBe('Parent')

    const nestedSelection = {
      id: Entry.id,
      title: Entry.title,
      locale: Entry.locale,
      children: Query.children({
        select: {id: Entry.id, title: Entry.title}
      })
    }
    const nestedQuery = {
      first: true,
      id: 'trans',
      locale: 'en',
      select: {
        availableFilters: Article.multi.find({select: nestedSelection})
      }
    } as const
    const nested = await store.resolve(
      scope.parse<typeof nestedQuery>(scope.stringify(nestedQuery))
    )
    expect(nested?.availableFilters).toEqual([
      {
        id: 'parent',
        title: 'Parent',
        locale: null,
        children: [
          {id: 'child-1', title: 'Alpha'},
          {id: 'child-2', title: 'beta'}
        ]
      }
    ])
  })
})

test('resolves link suffixes, rich text links and image metadata', async () => {
  await withAdvancedStore(async store => {
    const linked = await store.get({id: 'child-1', select: Article.single})
    expect(linked?.url).toBe('/parent/beta?filter=active#details')
    expect(linked?.href).toBe('/parent/beta?filter=active#details')

    const body = await store.get({id: 'child-1', select: Article.body})
    const firstNode = body?.[0]
    if (!firstNode || !Node.isElement(firstNode))
      throw new Error('Expected first rich text node to be an element')
    const firstText = firstNode.content?.[0]
    if (!firstText || !Node.isText(firstText))
      throw new Error('Expected first rich text child to be text')
    expect(firstText.marks?.[0]?.href).toBe(
      '/parent/beta?filter=active#details'
    )

    const image = await store.get({id: 'child-1', select: Article.heroImage})
    expect(image?.alt).toBe('Plain image alt')
    const gallery = await store.get({id: 'child-1', select: Article.gallery})
    expect(gallery?.[0]?.alt).toBe('Plain image alt')
    const localizedImage = await store.get({
      locale: 'de',
      root: mainWorkspace.localized,
      id: 'trans',
      select: Article.heroImage
    })
    expect(localizedImage?.alt).toBe('Texte alternatif francais')
  })
})
