import {createCMS, Entry} from '#/core.js'
import {ListRow} from '#/core/ListRow.js'
import {Config, Field} from '#/index.js'
import {createEntryIndex} from '#test/EntryFixture.js'
import {suite} from '@alinea/suite'
import {TestDB} from './TestDB.js'

const test = suite(import.meta)

const Page = Config.type('Page', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path')
  }
})

const DocumentPage = Config.document('Document page', {
  contains: ['DocumentPage'],
  fields: {}
})

const cms = createCMS({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages', {
          contains: ['Page']
        }),
        docs: Config.root('Docs', {
          contains: ['Page']
        })
      }
    })
  }
})

const documentCms = createCMS({
  schema: {DocumentPage},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages', {
          contains: ['DocumentPage']
        })
      }
    })
  }
})

function alias(url: string) {
  return {
    [ListRow.id]: `alias-${url}`,
    [ListRow.index]: 'a0',
    [ListRow.type]: 'alias',
    url
  }
}

function metadataWithAlias(url: string) {
  return {
    title: '',
    description: '',
    aliases: [alias(url)],
    openGraph: {
      image: null,
      title: '',
      description: ''
    },
    createdAt: null,
    createdBy: {name: '', email: ''},
    updatedAt: null,
    updatedBy: {name: '', email: ''}
  }
}

function metadataWithAliases(urls: Array<string>) {
  return {
    title: '',
    description: '',
    aliases: urls.map(alias),
    openGraph: {
      image: null,
      title: '',
      description: ''
    },
    createdAt: null,
    createdBy: {name: '', email: ''},
    updatedAt: null,
    updatedBy: {name: '', email: ''}
  }
}

function pageData(title: string, path: string, url: string) {
  return {
    title,
    path,
    metadata: metadataWithAlias(url)
  }
}

function pageDataWithAliases(title: string, path: string, urls: Array<string>) {
  return {
    title,
    path,
    metadata: metadataWithAliases(urls)
  }
}

async function createDb() {
  const {source} = await createEntryIndex(cms.config, [
    {
      id: 'one',
      type: 'Page',
      index: 'a1',
      root: 'pages',
      path: 'one',
      data: {
        title: 'One',
        metadata: metadataWithAlias('/old-one')
      }
    }
  ])
  const db = new TestDB(cms.config, source)
  await db.sync()
  return db
}

async function createEmptyDb() {
  const db = new TestDB(cms.config)
  await db.sync()
  return db
}

async function createDocumentDb() {
  const db = new TestDB(documentCms.config)
  await db.sync()
  return db
}

function aliasUrls(value: unknown): Array<string> {
  if (!Array.isArray(value)) return []
  return value.flatMap(alias => {
    if (!isRecord(alias)) return []
    const url = alias.url
    return typeof url === 'string' ? [url] : []
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

test('create blocks duplicate metadata URL aliases per root', async () => {
  const db = await createDb()

  await test.throws(
    () =>
      db.create({
        type: Page,
        root: 'pages',
        status: 'published',
        set: pageData('Two', 'two', '/old-one')
      }),
    'URL "/old-one" is already defined by entry one'
  )
})

test('create blocks aliases that conflict with canonical URLs', async () => {
  const db = await createDb()

  await test.throws(
    () =>
      db.create({
        type: Page,
        root: 'pages',
        status: 'published',
        set: pageData('Two', 'two', '/one')
      }),
    'URL "/one" is already defined by entry one'
  )
})

test('publish blocks duplicate metadata URL aliases per root', async () => {
  const db = await createDb()
  const draft = await db.create({
    type: Page,
    root: 'pages',
    status: 'draft',
    set: pageData('Two', 'two', '/old-one')
  })

  await test.throws(
    () =>
      db.publish({
        id: draft._id,
        status: 'draft'
      }),
    'URL "/old-one" is already defined by entry one'
  )
})

test('allows duplicate metadata URL aliases across roots', async () => {
  const db = await createDb()
  const entry = await db.create({
    type: Page,
    root: 'docs',
    status: 'published',
    set: pageData('Two', 'two', '/old-one')
  })

  test.is(entry._id.length > 0, true)
  const found = await db.first({
    root: 'docs',
    alias: '/old-one',
    select: Entry.id
  })
  test.is(found, entry._id)
})

test('allows duplicate metadata URL aliases on the same entry', async () => {
  const db = await createDb()
  const entry = await db.create({
    type: Page,
    root: 'pages',
    status: 'published',
    set: pageDataWithAliases('Two', 'two', ['/same-alias', '/same-alias'])
  })

  test.is(entry._id.length > 0, true)
})

test('update preserves the previous published URL as an alias', async () => {
  const db = await createDocumentDb()
  const entry = await db.create({
    type: DocumentPage,
    root: 'pages',
    status: 'published',
    set: {title: 'One', path: 'one'}
  })

  await db.update({
    type: DocumentPage,
    id: entry._id,
    status: 'published',
    set: {path: 'two'}
  })

  const result = await db.get({
    id: entry._id,
    select: {
      url: Entry.url,
      aliases: Entry.aliases
    }
  })
  test.is(result.url, '/two')
  test.equal(aliasUrls(result.aliases), ['/one'])
})

test('publish preserves the previous published URL as an alias', async () => {
  const db = await createDocumentDb()
  const entry = await db.create({
    type: DocumentPage,
    root: 'pages',
    status: 'published',
    set: {title: 'One', path: 'one'}
  })
  await db.create({
    type: DocumentPage,
    id: entry._id,
    root: 'pages',
    status: 'draft',
    overwrite: true,
    set: {title: 'One', path: 'two'}
  })

  await db.publish({
    id: entry._id,
    status: 'draft'
  })

  const result = await db.get({
    id: entry._id,
    select: {
      url: Entry.url,
      aliases: Entry.aliases
    }
  })
  test.is(result.url, '/two')
  test.equal(aliasUrls(result.aliases), ['/one'])
})

test('move preserves previous URLs for moved entries and children', async () => {
  const db = await createDocumentDb()
  const parent = await db.create({
    type: DocumentPage,
    root: 'pages',
    status: 'published',
    set: {title: 'Parent', path: 'parent'}
  })
  const target = await db.create({
    type: DocumentPage,
    root: 'pages',
    status: 'published',
    set: {title: 'Target', path: 'target'}
  })
  const child = await db.create({
    type: DocumentPage,
    root: 'pages',
    parentId: parent._id,
    status: 'published',
    set: {title: 'Child', path: 'child'}
  })

  await db.move({
    id: parent._id,
    target: target._id,
    dropPosition: 'on'
  })

  const movedParent = await db.get({
    id: parent._id,
    select: {
      url: Entry.url,
      aliases: Entry.aliases
    }
  })
  const movedChild = await db.get({
    id: child._id,
    select: {
      url: Entry.url,
      aliases: Entry.aliases
    }
  })
  test.is(movedParent.url, '/target/parent')
  test.equal(aliasUrls(movedParent.aliases), ['/parent'])
  test.is(movedChild.url, '/target/parent/child')
  test.equal(aliasUrls(movedChild.aliases), ['/parent/child'])
})

test('does not add URL aliases for types without metadata aliases', async () => {
  const db = await createEmptyDb()
  const entry = await db.create({
    type: Page,
    root: 'pages',
    status: 'published',
    set: {title: 'One', path: 'one'}
  })

  await db.update({
    type: Page,
    id: entry._id,
    status: 'published',
    set: {path: 'two'}
  })

  const aliases = await db.first({
    id: entry._id,
    select: Entry.aliases
  })
  test.is(aliases, undefined)
})
