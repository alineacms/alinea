import {createEntrySource} from '#test/EntryFixture.js'
import {expect, expectTypeOf, test} from 'bun:test'
import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {ListRow} from '#/core/ListRow.js'
import {Type} from '#/core/Type.js'
import {LocalDB} from '#/database/LocalDB.js'
import type {LinkRow} from '#/field/link.js'
import type {ListOptions} from '#/field/list/ListField.js'
import {Config, Field, Query} from '#/index.js'
import type {EntryReference} from '#/picker/entry/EntryReference.js'

// Checks that the inferred result types match what queries return at runtime

const Article = Config.document('Article', {
  fields: {
    title: Field.text('Title'),
    category: Field.text('Category'),
    related: Field.entry.multiple('Related'),
    website: Field.url('Website'),
    download: Field.file('Download'),
    image: Field.image('Image')
  }
})

const cms = createCMS({
  schema: {Article},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content/main',
      roots: {
        pages: Config.root('Pages', {contains: ['Article']}),
        media: Config.media()
      }
    })
  }
})

const mediaData = {
  title: 'Photo',
  location: '/photo.jpg',
  previewUrl: '/preview/photo.jpg',
  extension: '.jpg',
  size: 12,
  hash: 'photo-hash',
  width: 100,
  height: 80,
  averageColor: '#fff',
  focus: {x: 0.5, y: 0.5},
  thumbHash: 'photo-thumb'
}

const entries = [
  {
    id: 'parent',
    type: 'Article',
    index: 'a1',
    path: 'parent',
    data: {
      title: 'Parent',
      category: 'news',
      related: [
        {_id: 'rel-1', _type: 'entry', _index: 'a0', _entry: 'child-1'},
        {_id: 'rel-2', _type: 'entry', _index: 'a1', _entry: 'child-2'}
      ],
      website: {
        _id: 'url-1',
        _type: 'url',
        _url: 'https://example.com',
        _title: 'Example',
        _target: '_blank'
      },
      download: {_id: 'file-1', _type: 'file', _entry: 'photo'},
      image: {_id: 'image-1', _type: 'image', _entry: 'photo'}
    }
  },
  {
    id: 'child-1',
    type: 'Article',
    index: 'a1',
    parentPaths: ['parent'],
    path: 'child-1',
    data: {title: 'Child 1', category: 'news'}
  },
  {
    id: 'child-2',
    type: 'Article',
    index: 'a2',
    parentPaths: ['parent'],
    path: 'child-2',
    data: {title: 'Child 2', category: 'blog'}
  },
  {
    id: 'photo',
    type: 'MediaFile',
    index: 'm1',
    root: 'media',
    path: 'photo',
    data: mediaData
  }
]

async function withStore<T>(run: (store: LocalDB) => Promise<T>) {
  const store = new LocalDB(cms.config)
  const source = await createEntrySource(cms.config, entries)
  try {
    await store.syncWith(source)
    return await run(store)
  } finally {
    await store.close()
  }
}

test('url, file and image links include their url', async () => {
  await withStore(async store => {
    const links = await store.get({
      id: 'parent',
      select: {
        website: Article.website,
        download: Article.download,
        image: Article.image
      }
    })
    expectTypeOf(links.website!.url).toEqualTypeOf<string>()
    expectTypeOf(links.download!.url).toEqualTypeOf<string>()
    expectTypeOf(links.image!.url).toEqualTypeOf<string>()
    expect(links.website?.url).toBe('https://example.com')
    expect(links.website?.href).toBe('https://example.com')
    expect(links.download?.url).toMatch(/photo\.jpg$/)
    expect(links.download?.href).toBe(links.download?.url)
    expect(links.image?.url).toMatch(/photo\.jpg\?v=photo-hash$/)
    expect(links.image?.src).toBe(links.image?.url)
  })
})

test('relation helpers infer first and count', async () => {
  await withStore(async store => {
    const result = await store.get({
      id: 'parent',
      select: {
        all: Query.children({select: Entry.id}),
        first: Query.children({first: true, select: Entry.id}),
        count: Query.children({count: true}),
        parentCount: Query.parents({count: true}),
        related: Article.related.find({select: Entry.id}),
        relatedCount: Article.related.find({count: true}),
        relatedFirst: Article.related.find({first: true, select: Entry.id})
      }
    })
    expectTypeOf(result.all).toEqualTypeOf<Array<string>>()
    expectTypeOf(result.first).toEqualTypeOf<string | null>()
    expectTypeOf(result.count).toEqualTypeOf<number>()
    expectTypeOf(result.parentCount).toEqualTypeOf<number>()
    expectTypeOf(result.related).toEqualTypeOf<Array<string>>()
    expectTypeOf(result.relatedCount).toEqualTypeOf<number>()
    expectTypeOf(result.relatedFirst).toEqualTypeOf<string | null>()
    expect(result).toEqual({
      all: ['child-1', 'child-2'],
      first: 'child-1',
      count: 2,
      parentCount: 0,
      related: ['child-1', 'child-2'],
      relatedCount: 2,
      relatedFirst: 'child-1'
    })
  })
})

test('entry picker conditions accept field names', async () => {
  const condition = {_type: 'Article', category: 'news'}
  // Field keys are accepted next to the entry properties
  Field.entry('Pick', {condition: {_type: 'Article', category: 'news'}})
  Field.entry('Pick', {condition: {category: {in: ['news', 'blog']}}})
  // @ts-expect-error Entry properties keep their types
  Field.entry('Pick', {condition: {_type: 1}})
  await withStore(async store => {
    const ids = await store.find({filter: condition, select: Entry.id})
    expect(ids).toEqual(['parent', 'child-1'])
  })
})

test('relation helpers without a selection infer entries', async () => {
  await withStore(async store => {
    const result = await store.get({
      id: 'child-1',
      select: {
        parent: Query.parent({}),
        siblings: Query.siblings({}),
        siblingCount: Query.siblings({count: true, includeSelf: true}),
        firstRelated: Article.related.first()
      }
    })
    expectTypeOf(result.parent).toEqualTypeOf<EntryFields | null>()
    expectTypeOf(result.siblings).toEqualTypeOf<Array<EntryFields>>()
    expectTypeOf(result.siblingCount).toEqualTypeOf<number>()
    expectTypeOf(result.firstRelated).toEqualTypeOf<EntryFields | null>()
    expect(result.parent?._id).toBe('parent')
    expect(result.siblings.map(entry => entry._id)).toEqual(['child-2'])
    expect(result.siblingCount).toBe(2)
    expect(result.firstRelated ?? null).toBe(null)
  })
})

test('list rows can leave out fields and leave a single link empty in their initial value', () => {
  const Content = Config.type('Content', {
    fields: {
      title: Field.text('Title'),
      image: Field.image('Image', {required: false}),
      link: Field.link('Link'),
      related: Field.entry.multiple('Related')
    }
  })
  const withNull = Field.list('Content', {
    schema: {Content},
    initialValue: [{_type: 'Content', title: 'A', image: null, related: []}]
  })
  Field.list('Content', {
    schema: {Content},
    initialValue: [
      {_type: 'Content', title: 'B', image: undefined, related: []},
      {_type: 'Content', title: 'C', link: null, related: []}
    ]
  })
  Field.list('Content', {
    schema: {Content},
    // @ts-expect-error An empty string is not a link
    initialValue: [{_type: 'Content', title: 'D', image: '', related: []}]
  })
  Field.list('Content', {
    schema: {Content},
    // Fields left out get their default
    initialValue: [{_type: 'Content'}, {_type: 'Content', title: 'F'}]
  })
  Field.list('Content', {
    schema: {Content},
    // @ts-expect-error Rows name their type
    initialValue: [{title: 'G'}]
  })
  Field.list('Content', {
    schema: {Content},
    // @ts-expect-error Fields left in keep their type
    initialValue: [{_type: 'Content', title: 1}]
  })
  Field.list('Content', {
    schema: {Content},
    // @ts-expect-error Lists of links are not left empty with null
    initialValue: [{_type: 'Content', title: 'E', related: null}]
  })
  type Row = NonNullable<
    ListOptions<{Content: typeof Content}>['initialValue']
  >[number]
  expectTypeOf<Row['image']>().toEqualTypeOf<
    EntryReference | null | undefined
  >()
  expectTypeOf<Row['link']>().toEqualTypeOf<LinkRow | null | undefined>()
  expectTypeOf<Row['_type']>().toEqualTypeOf<'Content'>()
  expectTypeOf<Row['title']>().toEqualTypeOf<string | undefined>()
  expectTypeOf<Row['related']>().toEqualTypeOf<
    Array<EntryReference & ListRow> | undefined
  >()

  // An empty link is stored as null, like the initial value of a single link
  const Page = Config.type('Page', {
    fields: {
      content: withNull,
      omitted: Field.list('Omitted', {
        schema: {Content},
        initialValue: [
          {_type: 'Content', title: 'B', image: undefined, related: []},
          {_type: 'Content', title: 'C', related: []},
          {_type: 'Content'}
        ]
      })
    }
  })
  const initial = Type.initialValue(Page) as {
    content: Array<Record<string, unknown>>
    omitted: Array<Record<string, unknown>>
  }
  expect(Type.initialValue(Content).image).toBe(null)
  expect(initial.content[0].image).toBe(null)
  expect(initial.omitted.map(row => row.image)).toEqual([null, null, null])
  expect(initial.omitted.map(row => row.link)).toEqual([null, null, null])
  expect(initial.omitted.map(row => row.title)).toEqual(['B', 'C', ''])
  expect(initial.omitted.map(row => row.related)).toEqual([[], [], []])
})
