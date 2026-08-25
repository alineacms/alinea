import {createCMS, Entry} from '#/core.js'
import {ListRow} from '#/core/ListRow.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {isRecord} from '#/core/util/Objects.js'
import type {MetadataAlias} from '#/field/metadata/MetadataAliases.js'
import {Config, Field} from '#/index.js'
import {createEntrySource} from '#test/EntryFixture.js'
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
      mediaUrl: ({path, extension}) => `/assets/${path}${extension}`,
      roots: {
        pages: Config.root('Pages', {
          contains: ['Page']
        }),
        docs: Config.root('Docs', {
          contains: ['Page']
        }),
        media: Config.media({
          contains: ['MediaFile']
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

function alias(url: string): MetadataAlias {
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

function mediaFileData(title: string, path: string, aliases: Array<string>) {
  return {
    title,
    path,
    metadata: {
      aliases: aliases.map(alias)
    },
    location: `/${path}.jpg`,
    extension: '.jpg',
    size: 1024,
    hash: `${path}-hash`
  }
}

async function createDb() {
  const source = await createEntrySource(cms.config, [
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

test('create blocks duplicate MediaFile URL aliases per root', async () => {
  const db = await createDb()

  await db.create({
    type: MediaFile,
    root: 'media',
    status: 'published',
    set: mediaFileData('One', 'one', ['/old-file'])
  })

  await test.throws(
    () =>
      db.create({
        type: MediaFile,
        root: 'media',
        status: 'published',
        set: mediaFileData('Two', 'two', ['/old-file'])
      }),
    'URL "/old-file" is already defined by entry'
  )
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

test('update does not add a MediaFile alias when its public URL is unchanged', async () => {
  const db = await createEmptyDb()
  const entry = await db.create({
    type: MediaFile,
    root: 'media',
    status: 'published',
    set: mediaFileData('One', 'one', [])
  })

  await db.update({
    type: MediaFile,
    id: entry._id,
    status: 'published',
    set: {location: '/replacement.jpg'}
  })

  const aliases = await db.get({
    id: entry._id,
    select: Entry.aliases
  })
  test.equal(aliasUrls(aliases), [])
})

test('update preserves the previous MediaFile URL as an alias', async () => {
  const db = await createEmptyDb()
  const entry = await db.create({
    type: MediaFile,
    root: 'media',
    status: 'published',
    set: mediaFileData('One', 'one', [])
  })

  await db.update({
    type: MediaFile,
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
  test.equal(aliasUrls(result.aliases), ['/assets/one.jpg'])
})

test('update preserves a MediaFile URL with an empty alias row', async () => {
  const db = await createEmptyDb()
  const emptyAlias = {
    ...alias(''),
    [ListRow.index]: ''
  }
  const data = mediaFileData('One', 'one', [])
  const entry = await db.create({
    type: MediaFile,
    root: 'media',
    status: 'published',
    set: {
      ...data,
      metadata: {
        ...data.metadata,
        aliases: [emptyAlias]
      }
    }
  })

  await db.update({
    type: MediaFile,
    id: entry._id,
    status: 'published',
    set: {path: 'two'}
  })

  const aliases = await db.get({
    id: entry._id,
    select: Entry.aliases
  })
  test.equal(aliasUrls(aliases), ['', '/assets/one.jpg'])
})

test('update removes a current MediaFile URL from legacy aliases', async () => {
  const source = await createEntrySource(cms.config, [
    {
      id: 'media-one',
      type: 'MediaFile',
      index: 'a1',
      root: 'media',
      path: 'one',
      data: {
        ...mediaFileData('One', 'one', []),
        aliases: [alias('/assets/two.jpg')]
      }
    }
  ])
  const db = new TestDB(cms.config, source)
  await db.sync()

  await db.update({
    type: MediaFile,
    id: 'media-one',
    status: 'published',
    set: {path: 'two'}
  })

  const aliases = await db.get({
    id: 'media-one',
    select: Entry.aliases
  })
  test.equal(aliasUrls(aliases), ['/assets/one.jpg'])
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

test('publish preserves the previous public MediaFile URL as an alias', async () => {
  const db = await createEmptyDb()
  const entry = await db.create({
    type: MediaFile,
    root: 'media',
    status: 'published',
    set: mediaFileData('One', 'one', [])
  })
  await db.create({
    type: MediaFile,
    id: entry._id,
    root: 'media',
    status: 'draft',
    overwrite: true,
    set: {
      ...mediaFileData('One', 'two', []),
      extension: '.png',
      location: '/replacement.png'
    }
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
  test.equal(aliasUrls(result.aliases), ['/assets/one.jpg'])
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
