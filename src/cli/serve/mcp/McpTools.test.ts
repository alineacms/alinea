import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import {Entry} from '#/core/Entry.js'
import {createPreview} from '#/core/media/CreatePreview.js'
import {Type} from '#/core/Type.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'
import {DevDB} from '../../generate/DevDB.js'
import {LocalAuth} from '../LocalAuth.js'
import {MemoryDrafts} from '../MemoryDrafts.js'
import {createDevMcp} from './DevMcp.js'
import {McpGraph} from './McpGraph.js'

const test = suite(import.meta)

const CodeBlock = Config.type('Code', {
  fields: {
    code: Field.code('Code'),
    language: Field.text('Language')
  }
})

const Notice = Config.type('Notice', {
  fields: {
    level: Field.select('Level', {options: {info: 'Info', warning: 'Warning'}}),
    text: Field.richText('Text')
  }
})

const Item = Config.type('Item', {
  fields: {
    text: Field.text('Text')
  }
})

const Feature = Config.type('Feature', {
  fields: {
    title: Field.text('Title'),
    link: Field.link('Link'),
    items: Field.list('Items', {schema: {Item}})
  }
})

const localised = Field.localiser({locales: ['en', 'nl']})

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {
    intro: Field.text('Intro', {multiline: true}),
    body: Field.richText('Body', {schema: {CodeBlock, Notice}}),
    features: Field.list('Features', {schema: {Feature}}),
    related: Field.entry.multiple('Related'),
    image: Field.image('Image'),
    color: Field.select('Color', {options: {red: 'Red', blue: 'Blue'}}),
    seo: Field.object('SEO', {
      fields: {
        keywords: Field.text('Keywords'),
        robots: Field.text('Robots')
      }
    }),
    tagline: localised(Field.text('Tagline'))
  }
})

const Post = Config.document('Post', {
  fields: {
    summary: Field.text('Summary'),
    category: Field.text('Category', {shared: true})
  }
})

const cms = createCMS({
  enableDrafts: true,
  handlerUrl: '/api',
  schema: {Page, Post},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      mediaDir: 'public/media',
      roots: {
        pages: Config.root('Pages', {contains: ['Page']}),
        blog: Config.root('Blog', {
          contains: ['Post'],
          i18n: {locales: ['en', 'nl']}
        }),
        media: Config.media()
      }
    })
  }
})

const user = {
  sub: 'test',
  name: 'Test user',
  email: 't@example.com',
  roles: ['admin']
}
const origin = 'http://localhost:4500'

interface ToolResult {
  isError: boolean
  text: string
  // Tool results are parsed JSON of any shape, assertions check them
  data: Record<string, any>
}

async function setup() {
  // The project lives in a subdirectory of a git repository
  const repoDir = await mkdtemp(join(tmpdir(), 'alinea-mcp-'))
  await mkdir(join(repoDir, '.git'))
  const rootDir = join(repoDir, 'site')
  await mkdir(join(rootDir, 'content'), {recursive: true})
  const db = await DevDB.create({
    config: cms.config,
    rootDir,
    databasePath: join(rootDir, 'database.sqlite'),
    dashboardUrl: origin
  })
  await db.sync()
  const handler = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(
        new LocalAuth(context, Promise.resolve(user)),
        db,
        new MemoryDrafts()
      )
    }
  })
  function handleApi(request: Request) {
    return handler(request, {
      isDev: true,
      handlerUrl: new URL(`${origin}/api`),
      apiKey: 'dev'
    })
  }
  const handleMcp = createDevMcp({
    config: cms.config,
    db,
    rootDir,
    user,
    handleApi
  })
  // Writes the way the dashboard does, for comparisons
  const graph = new McpGraph({
    config: cms.config,
    db,
    handle: handleApi,
    handlerUrl: `${origin}/api`
  })
  let id = 0
  async function call(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const response = await handleMcp(
      new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++id,
          method: 'tools/call',
          params: {name, arguments: args}
        })
      })
    )
    const body = await response.json()
    if (body.error) throw new Error(body.error.message)
    const text: string = body.result.content[0].text
    const isError = body.result.isError === true
    return {isError, text, data: isError ? {} : JSON.parse(text)}
  }
  async function ok(name: string, args: Record<string, unknown>) {
    const result = await call(name, args)
    if (result.isError) throw new Error(`${name} failed: ${result.text}`)
    return result.data
  }
  async function readEntry(file: string) {
    return JSON.parse(await readFile(join(rootDir, file), 'utf8'))
  }
  function readText(file: string) {
    return readFile(join(rootDir, file), 'utf8')
  }
  /** Write an entry file by hand and let the dev database pick it up */
  async function writeText(file: string, text: string) {
    await writeFile(join(rootDir, file), text)
    await db.sync()
  }
  /** Save an entry like the dashboard's editor: publishEdits */
  async function dashboardSave(
    id: string,
    edit: (value: Record<string, unknown>) => void,
    locale: string | null = null
  ) {
    const entry = (await graph.get({
      id,
      locale,
      status: 'preferDraft',
      select: {type: Entry.type, data: Entry.data}
    })) as {type: string; data: Record<string, unknown>}
    const type = (cms.config.schema as Record<string, Type>)[entry.type]
    const value = Type.withInitialValue(type, {
      ...Type.initialValue(type),
      ...entry.data
    })
    edit(value)
    await graph.create({
      type,
      id,
      locale,
      status: 'published',
      set: Type.beforeSave(type, value, {
        action: 'publish',
        user,
        now: new Date()
      }),
      overwrite: true
    })
  }
  /** Upload a file like the dashboard's media library does */
  async function dashboardUpload(file: File) {
    const uploaded = (await graph.upload({
      file,
      createPreview,
      workspace: 'main',
      root: 'media'
    })) as {_id: string}
    return (await graph.get({
      id: uploaded._id,
      select: Entry.filePath
    })) as string
  }
  return {
    repoDir,
    rootDir,
    dashboardUpload,
    call,
    ok,
    readEntry,
    readText,
    writeText,
    dashboardSave,
    async [Symbol.asyncDispose]() {
      await db.close()
      await rm(repoDir, {recursive: true, force: true})
    }
  }
}

test('describe_schema', async () => {
  await using env = await setup()
  const schema = await env.ok('describe_schema', {})
  test.is(schema.enableDrafts, true)
  const [main] = schema.workspaces
  test.is(main.name, 'main')
  test.equal(
    main.roots.map((root: {name: string}) => root.name),
    ['pages', 'blog', 'media']
  )
  test.equal(main.roots[1].locales, ['en', 'nl'])
  const page = schema.types.find((type: {name: string}) => type.name === 'Page')
  test.equal(page.contains, ['Page'])
  const byKey = page.fields
  test.is(byKey.title, 'text (required)')
  test.is(byKey.body, 'richText[CodeBlock|Notice]')
  test.is(byKey.features, 'list[Feature]')
  test.is(byKey.related, 'link[entry] (multiple)')
  test.is(byKey.image, 'link[image]')
  test.equal(byKey.color.options, {red: 'Red', blue: 'Blue'})
  test.equal(byKey.tagline.locales, ['en', 'nl'])
  test.is(byKey.seo.fields.keywords, 'text')
  test.is(byKey.intro, 'text (multiline)')
  test.is(schema.definitions.Notice.fields.text, 'richText')
  test.ok(schema.valueFormats.mediaAlt)
  const single = await env.ok('describe_schema', {type: 'Post'})
  test.is(single.type.name, 'Post')
  const summary = await env.ok('describe_schema', {detail: 'summary'})
  test.is(summary.types.Page.fields.features, 'list[Feature]')
  test.is(summary.types.Page.fields.tagline, 'localised(text)')
  test.is(summary.types.Page.fields.seo, 'object')
  test.equal(summary.types.Page.contains, ['Page'])
  test.equal(summary.workspaces[0].roots[1].locales, ['en', 'nl'])
  test.is(summary.valueFormats, undefined)
  const missing = await env.call('describe_schema', {type: 'Nope'})
  test.is(missing.isError, true)
})

test('create, read, update and delete entries', async () => {
  await using env = await setup()
  const created = await env.ok('create_entry', {
    type: 'Page',
    root: 'pages',
    data: {
      title: 'Hello world',
      intro: 'An intro',
      body: '# Welcome\n\nSome **bold** text.\n\n```ts\nconst a = 1\n```\n\n- one\n- two',
      features: [{title: 'Fast', link: 'https://alinea.sh'}],
      color: 'Blue',
      seo: {keywords: 'cms'},
      tagline: {en: 'Hi'}
    }
  })
  test.is(created.path, 'hello-world')
  test.is(created.url, '/hello-world')
  test.is(created.status, 'published')
  test.is(created.file, 'content/pages/hello-world.json')
  const stored = await env.readEntry(created.file)
  test.is(stored._id, created.id)
  test.is(stored._type, 'Page')
  test.is(stored.color, 'blue')
  test.equal(stored.tagline, {en: 'Hi', nl: ''})
  test.equal(stored.seo, {keywords: 'cms', robots: ''})
  test.is(stored.body[0]._type, 'heading')
  test.equal(stored.body[1].content[1], {
    _type: 'text',
    text: 'bold',
    marks: [{_type: 'bold'}]
  })
  test.is(stored.body[2]._type, 'CodeBlock')
  test.is(stored.body[2].code, 'const a = 1')
  test.is(stored.body[2].language, 'ts')
  test.is(typeof stored.body[2]._id, 'string')
  test.is(stored.body[3]._type, 'bulletList')
  const [feature] = stored.features
  test.is(feature._type, 'Feature')
  test.is(typeof feature._id, 'string')
  test.is(typeof feature._index, 'string')
  test.is(feature.link._type, 'url')
  test.is(feature.link._url, 'https://alinea.sh')

  // Links to entries
  const second = await env.ok('create_entry', {
    type: 'Page',
    parentId: created.id,
    data: {
      title: 'Child',
      related: [created.id],
      body: `See [the parent](entry:${created.id})`
    }
  })
  test.is(second.url, '/hello-world/child')
  test.is(second.parentId, created.id)
  const child = await env.readEntry(second.file)
  test.is(child.related[0]._entry, created.id)
  test.is(child.related[0]._type, 'entry')
  test.is(child.body[0].content[1].marks[0]._entry, created.id)

  // Read back as markdown
  const read = await env.ok('get_entry', {id: second.id})
  test.is(read.data.body, `See [the parent](entry:${created.id})`)
  test.is(read.file, 'content/pages/hello-world/child.json')
  const byUrl = await env.ok('get_entry', {
    url: '/hello-world',
    richText: 'raw'
  })
  test.is(byUrl.id, created.id)
  test.is(byUrl.childrenCount, 1)
  test.ok(Array.isArray(byUrl.data.body))

  // Find
  const found = await env.ok('find_entries', {root: 'pages', parentId: null})
  test.is(found.total, 1)
  test.is(found.entries[0].childrenCount, 1)
  const searched = await env.ok('find_entries', {type: 'Page', search: 'Child'})
  test.is(searched.entries[0].id, second.id)

  // Partial update keeps other fields
  const updated = await env.ok('update_entry', {
    id: created.id,
    data: {intro: 'Changed', seo: {robots: 'noindex'}, tagline: {nl: 'Hoi'}}
  })
  test.equal(updated.changed, ['intro', 'seo', 'tagline'])
  const afterUpdate = await env.readEntry(created.file)
  test.is(afterUpdate.intro, 'Changed')
  test.equal(afterUpdate.seo, {keywords: 'cms', robots: 'noindex'})
  test.equal(afterUpdate.tagline, {en: 'Hi', nl: 'Hoi'})
  test.equal(afterUpdate.body, stored.body)
  test.equal(afterUpdate.features, stored.features)

  // Drafts
  const draft = await env.ok('update_entry', {
    id: created.id,
    data: {intro: 'Draft intro'},
    publish: false
  })
  test.is(draft.status, 'draft')
  test.is(draft.file, 'content/pages/hello-world.draft.json')
  test.is((await env.readEntry(created.file)).intro, 'Changed')
  const published = await env.ok('publish_entry', {id: created.id})
  test.is(published.from, 'draft')
  test.is((await env.readEntry(created.file)).intro, 'Draft intro')

  // Delete
  const deleted = await env.ok('delete_entry', {id: second.id})
  test.is(deleted.deleted[0].title, 'Child')
  await test.throws(() => env.readEntry(second.file))
})

test('validation errors name the field and what is expected', async () => {
  await using env = await setup()
  const unknownField = await env.call('create_entry', {
    type: 'Page',
    data: {title: 'x', nope: 1}
  })
  test.is(unknownField.isError, true)
  test.ok(unknownField.text.startsWith('nope: unknown field'))
  const wrongType = await env.call('create_entry', {
    type: 'Page',
    data: {title: 'x', features: [{title: 3}]}
  })
  test.is(
    wrongType.text,
    'features[0].title: expected a string for text field "Title", got number 3'
  )
  const badOption = await env.call('create_entry', {
    type: 'Page',
    data: {title: 'x', color: 'green'}
  })
  test.ok(badOption.text.includes('"red", "blue"'))
  const notAllowed = await env.call('create_entry', {
    type: 'Post',
    root: 'pages',
    data: {title: 'x'}
  })
  test.is(
    notAllowed.text,
    'Type "Post" is not allowed in root "pages", allowed types: Page'
  )
  const missingRef = await env.call('create_entry', {
    type: 'Page',
    data: {title: 'x', related: ['missing']}
  })
  test.ok(
    missingRef.text.startsWith('related[0]: entry "missing" does not exist')
  )
  const missingTitle = await env.call('create_entry', {
    type: 'Page',
    data: {intro: 'x'}
  })
  test.is(missingTitle.text, 'data.title: a title is required')
  const badBlock = await env.call('create_entry', {
    type: 'Page',
    data: {title: 'x', body: [{_type: 'Video'}]}
  })
  test.is(
    badBlock.text,
    'body[0]: unknown block "Video", this field accepts: CodeBlock, Notice'
  )
})

test('translations and moves', async () => {
  await using env = await setup()
  const en = await env.ok('create_entry', {
    type: 'Post',
    root: 'blog',
    data: {title: 'Hello'}
  })
  test.is(en.locale, 'en')
  test.is(en.file, 'content/blog/en/hello.json')
  const nl = await env.ok('create_entry', {
    translationOf: en.id,
    locale: 'nl',
    data: {title: 'Hallo'}
  })
  test.is(nl.id, en.id)
  test.is(nl.file, 'content/blog/nl/hallo.json')
  // Without a locale the root's default locale is read
  const byDefault = await env.ok('get_entry', {id: en.id})
  test.is(byDefault.locale, 'en')
  test.equal(byDefault.otherLocales, ['nl'])
  const dutch = await env.ok('get_entry', {id: en.id, locale: 'nl'})
  test.is(dutch.data.title, 'Hallo')
  test.equal(dutch.otherLocales, ['en'])
  const duplicate = await env.call('create_entry', {
    translationOf: en.id,
    locale: 'nl',
    data: {title: 'Again'}
  })
  test.ok(duplicate.text.includes('already has a "nl" translation'))

  const a = await env.ok('create_entry', {type: 'Page', data: {title: 'A'}})
  const b = await env.ok('create_entry', {type: 'Page', data: {title: 'B'}})
  const moved = await env.ok('move_entry', {id: b.id, parentId: a.id})
  test.is(moved.file, 'content/pages/a/b.json')
  const back = await env.ok('move_entry', {id: b.id, before: a.id})
  test.is(back.file, 'content/pages/b.json')
  const order = await env.ok('find_entries', {root: 'pages', parentId: null})
  test.equal(
    order.entries.map((entry: {title: string}) => entry.title),
    ['B', 'A']
  )
  const archived = await env.ok('archive_entry', {id: a.id})
  test.is(archived.status, 'archived')
  const restored = await env.ok('publish_entry', {id: a.id})
  test.is(restored.from, 'archived')
})

test('upload_file creates a media entry', async () => {
  await using env = await setup()
  await copyFile('test/fixtures/example.jpg', join(env.rootDir, 'example.jpg'))
  const fetch = globalThis.fetch
  // Stand in for the dev server's upload endpoint
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      const file = url.searchParams.get('file')!
      const location = join(env.rootDir, file)
      await mkdir(dirname(location), {recursive: true})
      await writeFile(location, new Uint8Array(init!.body as ArrayBuffer))
      return new Response('Upload ok')
    },
    {preconnect: fetch.preconnect}
  )
  try {
    const outside = await env.call('upload_file', {path: '../../secret.jpg'})
    test.is(outside.isError, true)
    test.ok(outside.text.includes(join(env.repoDir, '..', 'secret.jpg')))
    test.ok(outside.text.includes(env.rootDir))
    test.ok(outside.text.includes(env.repoDir))
    const media = await env.ok('upload_file', {
      path: 'example.jpg',
      title: 'A photo'
    })
    test.is(media.title, 'A photo')
    test.is(media.extension, '.jpg')
    test.ok(media.width > 0)
    test.ok(String(media.location).startsWith('/a-photo.'))
    test.ok(String(media.url).endsWith('/a-photo.jpg'))
    const stored = await env.readEntry(media.file)
    // The same entry as a dashboard upload of the same file
    const viaDashboard = await env.readEntry(
      join(
        'content',
        await env.dashboardUpload(
          new File([await readFile('test/fixtures/example.jpg')], 'A photo.jpg')
        )
      )
    )
    const {_id, _index, location, ...same} = viaDashboard
    test.equal(Object.keys(stored), Object.keys(viaDashboard))
    test.equal(
      {...stored, _id, _index, location},
      {...same, _id, _index, location}
    )
    test.is(stored._type, 'MediaFile')
    test.is(typeof stored.thumbHash, 'string')
    test.is(typeof stored.averageColor, 'string')
    test.is('previewUrl' in stored, false)
    const page = await env.ok('create_entry', {
      type: 'Page',
      data: {title: 'With image', image: media.id}
    })
    const pageData = await env.readEntry(page.file)
    test.is(pageData.image._type, 'image')
    test.is(pageData.image._entry, media.id)
    const wrong = await env.call('create_entry', {
      type: 'Page',
      data: {title: 'Wrong image', image: page.id}
    })
    test.ok(wrong.text.includes('image links need a media file'))

    // Into a folder, from an absolute path in the enclosing repository, with
    // alt text and focus point
    const folder = await env.ok('create_entry', {
      type: 'MediaLibrary',
      root: 'media',
      data: {title: 'Photos'}
    })
    await copyFile(
      'test/fixtures/example.jpg',
      join(env.repoDir, 'scratch.jpg')
    )
    const photo = await env.ok('upload_file', {
      path: join(env.repoDir, 'scratch.jpg'),
      parentId: folder.id,
      alt: 'A scratch photo',
      focus: {x: 0.2, y: 0.8}
    })
    test.is(photo.title, 'scratch')
    test.is(photo.file, 'content/media/photos/scratch.json')
    // Files are stored in the media directory, like dashboard uploads
    test.ok(String(photo.storedAt).startsWith('public/media/scratch.'))
    test.is(photo.publicUrl, photo.location.replace(/^/, '/media'))
    const photoData = await env.readEntry(photo.file)
    test.is(photoData.alt, 'A scratch photo')
    test.equal(photoData.focus, {x: 0.2, y: 0.8})
    test.equal(
      Object.keys(photoData).indexOf('alt'),
      Object.keys(photoData).indexOf('hash') + 1
    )
    await readFile(join(env.rootDir, photo.storedAt))

    // Replacing keeps the id, title, alt and focus, recomputes the rest
    const {default: sharp} = await import('sharp')
    await writeFile(
      join(env.rootDir, 'red.png'),
      await sharp({
        create: {width: 20, height: 10, channels: 3, background: '#ff0000'}
      })
        .png()
        .toBuffer()
    )
    const replaced = await env.ok('upload_file', {
      path: 'red.png',
      replace: photo.id
    })
    test.is(replaced.id, photo.id)
    test.is(replaced.file, photo.file)
    test.is(replaced.extension, '.png')
    test.is(replaced.width, 20)
    test.is(replaced.replaced.location, photo.location)
    test.ok(replaced.location !== photo.location)
    await test.throws(() => readFile(join(env.rootDir, photo.storedAt)))
    await readFile(join(env.rootDir, replaced.storedAt))
    const replacedData = await env.readEntry(replaced.file)
    // The url changed with the extension, the old one stays as an alias
    test.equal(Object.keys(replacedData), [
      ...Object.keys(photoData),
      'metadata'
    ])
    test.is(replacedData.metadata.aliases[0].url, photo.url)
    test.is(replacedData._id, photoData._id)
    test.is(replacedData.title, 'scratch')
    test.is(replacedData.alt, 'A scratch photo')
    test.equal(replacedData.focus, {x: 0.2, y: 0.8})
    test.ok(replacedData.hash !== photoData.hash)
    test.ok(replacedData.thumbHash !== photoData.thumbHash)
    test.is(replacedData.height, 10)
    // Links to the media entry keep working
    const linked = await env.ok('find_references', {id: photo.id})
    test.equal(linked.incoming, [])
    const notMedia = await env.call('upload_file', {
      path: 'red.png',
      replace: page.id
    })
    test.ok(notMedia.text.includes('is not a media file entry'))
  } finally {
    globalThis.fetch = fetch
  }
})

interface Row {
  _id: string
  [field: string]: unknown
}

test('updates only change what was asked', async () => {
  await using env = await setup()
  const created = await env.ok('create_entry', {
    type: 'Page',
    data: {
      title: 'Minimal',
      intro: 'Intro',
      features: [
        {title: 'One', items: [{text: 'a'}, {text: 'b'}]},
        {title: 'Two'}
      ]
    }
  })
  // Content written by hand: no defaults, its own key order, legacy meta
  const handWritten = await env.readEntry(created.file)
  const [one, two] = handWritten.features as Array<Row>
  const custom = {
    _id: handWritten._id,
    _type: 'Page',
    _index: handWritten._index,
    title: 'Minimal',
    features: [
      {
        _id: one._id,
        _index: one._index,
        _type: 'Feature',
        title: 'One',
        items: one.items
      },
      {_type: 'Feature', _id: two._id, title: 'Two'}
    ],
    intro: 'Intro'
  }
  const text = JSON.stringify(custom, null, 2)
  await env.writeText(created.file, text)

  // A row patch touches that row's field only
  await env.ok('update_entry', {
    id: created.id,
    data: {features: {update: [{_id: two._id, title: 'Second'}]}}
  })
  // Only the row's title changed, metadata records the edit like the
  // dashboard's save does
  const patched = await env.readEntry(created.file)
  test.ok(patched.metadata.updatedAt > 0)
  delete patched.metadata
  test.is(
    JSON.stringify(patched, null, 2),
    text.replace('"title": "Two"', '"title": "Second"')
  )
  // An array with partial rows merges rows by _id
  await env.ok('update_entry', {
    id: created.id,
    data: {features: [{_id: two._id}, {_id: one._id, title: 'First'}]}
  })
  const reordered = await env.readEntry(created.file)
  delete reordered.metadata
  test.equal(reordered.features, [
    {_type: 'Feature', _id: two._id, title: 'Second'},
    {...custom.features[0], title: 'First'}
  ])
  test.equal(Object.keys(reordered), Object.keys(custom))

  // Operations: insert, remove, order and nested lists
  const inserted = await env.ok('update_entry', {
    id: created.id,
    data: {
      features: {
        update: [
          {
            _id: one._id,
            items: {
              insert: [
                {row: {text: 'c'}, after: (one.items as Array<Row>)[0]._id}
              ]
            }
          }
        ],
        insert: [{row: {title: 'Zero'}, before: two._id}]
      }
    }
  })
  test.equal(inserted.changed, ['features'])
  const afterInsert = (await env.readEntry(created.file)).features as Array<Row>
  test.equal(
    afterInsert.map(row => row.title),
    ['Zero', 'Second', 'First']
  )
  const zero = afterInsert[0]
  // New rows are shaped like the dashboard creates them
  test.equal(Object.keys(zero), [
    '_id',
    '_index',
    '_type',
    'title',
    'link',
    'items'
  ])
  test.is(zero._index, '')
  test.equal(
    (afterInsert[2].items as Array<Row>).map(row => row.text),
    ['a', 'c', 'b']
  )
  await env.ok('update_entry', {
    id: created.id,
    data: {features: {remove: [zero._id], order: [one._id, two._id]}}
  })
  test.equal(
    ((await env.readEntry(created.file)).features as Array<Row>).map(
      row => row.title
    ),
    ['First', 'Second']
  )
  const missing = await env.call('update_entry', {
    id: created.id,
    data: {features: {remove: ['nope']}}
  })
  test.ok(missing.text.startsWith('features.remove[0]: no row with _id "nope"'))
  const badOrder = await env.call('update_entry', {
    id: created.id,
    data: {features: {order: [one._id]}}
  })
  test.ok(badOrder.text.startsWith('features.order: expected every row _id'))
})

test('writes match the dashboard for the same edit', async () => {
  await using env = await setup()
  const target = await env.ok('create_entry', {
    type: 'Page',
    data: {title: 'Target'}
  })
  const created = await env.ok('create_entry', {
    type: 'Page',
    data: {
      title: 'Same',
      intro: 'Intro',
      body: 'Hello **world**\n\n```ts\nlet a = 1\n```',
      features: [{title: 'One'}, {title: 'Two', link: 'https://alinea.sh'}],
      seo: {keywords: 'cms'}
    }
  })
  const original = await env.readText(created.file)
  const rows = (await env.readEntry(created.file)).features as Array<Row>
  const edits: Array<
    [Record<string, unknown>, (value: Record<string, unknown>) => void]
  > = [
    [
      {intro: 'Changed'},
      value => {
        value.intro = 'Changed'
      }
    ],
    [
      {features: {update: [{_id: rows[1]._id, title: 'Second'}]}},
      value => {
        const features = value.features as Array<Row>
        features[1] = {...features[1], title: 'Second'}
      }
    ],
    [
      {seo: {robots: 'noindex'}},
      value => {
        value.seo = {...(value.seo as object), robots: 'noindex'}
      }
    ],
    [
      {color: 'red', tagline: {nl: 'Hoi'}},
      value => {
        value.color = 'red'
        value.tagline = {...(value.tagline as object), nl: 'Hoi'}
      }
    ]
  ]
  for (const [data, edit] of edits) {
    await env.dashboardSave(created.id, edit)
    const dashboard = await env.readText(created.file)
    await env.writeText(created.file, original)
    await env.ok('update_entry', {id: created.id, data})
    // Saved a second apart the audit timestamp may differ
    const stamp = (text: string) =>
      text.replace(/"updatedAt": \d+/, '"updatedAt": 0')
    test.is(stamp(await env.readText(created.file)), stamp(dashboard))
    await env.writeText(created.file, original)
  }
  // Resending the Markdown of a rich text field keeps it as it is
  const read = await env.ok('get_entry', {id: created.id})
  test.ok(String(read.data.body).includes('```ts id='))
  await env.ok('update_entry', {id: created.id, data: {body: read.data.body}})
  test.is(await env.readText(created.file), original)
  // A single link to a new entry is shaped like the dashboard's picker
  await env.ok('update_entry', {id: created.id, data: {related: [target.id]}})
  const [related] = (await env.readEntry(created.file)).related as Array<Row>
  test.equal(Object.keys(related), ['_id', '_type', '_index', '_entry'])
})

test('shared fields only touch other locales when they change', async () => {
  await using env = await setup()
  const en = await env.ok('create_entry', {
    type: 'Post',
    root: 'blog',
    data: {title: 'Hello', summary: 'Hi', category: 'News'}
  })
  const nl = await env.ok('create_entry', {
    translationOf: en.id,
    locale: 'nl',
    data: {title: 'Hallo', summary: 'Hoi'}
  })
  test.is((await env.readEntry(nl.file)).category, 'News')
  const dutch = JSON.stringify(
    {...(await env.readEntry(nl.file)), extra: 1},
    null,
    2
  )
  await env.writeText(nl.file, dutch)
  await env.ok('update_entry', {
    id: en.id,
    locale: 'en',
    data: {summary: 'Hey'}
  })
  test.is(await env.readText(nl.file), dutch)
  await env.ok('update_entry', {id: en.id, data: {category: 'Updates'}})
  const updated = await env.readEntry(nl.file)
  test.is(updated.category, 'Updates')
  test.is(updated.summary, 'Hoi')
})

test('find_references and guarded deletes', async () => {
  await using env = await setup()
  const target = await env.ok('create_entry', {
    type: 'Page',
    data: {title: 'Target'}
  })
  const child = await env.ok('create_entry', {
    type: 'Page',
    parentId: target.id,
    data: {title: 'Child', related: [target.id]}
  })
  const source = await env.ok('create_entry', {
    type: 'Page',
    data: {
      title: 'Source',
      related: [target.id],
      body: `See [child](entry:${child.id})`
    }
  })
  const references = await env.ok('find_references', {id: target.id})
  test.equal(
    references.incoming
      .map((ref: {title: string; field: string}) => [
        ref.title,
        ref.field.split('.')[0]
      ])
      .sort(),
    [
      ['Child', 'related'],
      ['Source', 'related']
    ]
  )
  const outgoing = await env.ok('find_references', {id: source.id})
  test.equal(
    outgoing.outgoing.map((ref: {id: string; title: string}) => [
      ref.id,
      ref.title
    ]),
    [
      [child.id, 'Child'],
      [target.id, 'Target']
    ]
  )
  const refused = await env.call('delete_entry', {id: target.id})
  test.is(refused.isError, true)
  test.ok(refused.text.includes('linked from 1 place(s)'))
  test.ok(refused.text.includes(`Source (Page, id ${source.id}) field related`))
  // References from its own children do not count
  test.ok(!refused.text.includes(child.id))
  const forced = await env.ok('delete_entry', {id: target.id, force: true})
  test.ok(forced.warning.includes(source.id))
})

test('find_entries lists entries in tree order', async () => {
  await using env = await setup()
  const a = await env.ok('create_entry', {type: 'Page', data: {title: 'A'}})
  await env.ok('create_entry', {type: 'Page', data: {title: 'B'}})
  const child = await env.ok('create_entry', {
    type: 'Page',
    parentId: a.id,
    data: {title: 'A child'}
  })
  await env.ok('create_entry', {
    type: 'Page',
    parentId: child.id,
    data: {title: 'A grandchild'}
  })
  const found = await env.ok('find_entries', {root: 'pages'})
  test.equal(
    found.entries.map((entry: {title: string}) => entry.title),
    ['A', 'A child', 'A grandchild', 'B']
  )
  const paged = await env.ok('find_entries', {
    root: 'pages',
    offset: 1,
    limit: 2
  })
  test.equal(
    paged.entries.map((entry: {title: string}) => entry.title),
    ['A child', 'A grandchild']
  )
})

test('reads reflect files changed on disk', async () => {
  await using env = await setup()
  const created = await env.ok('create_entry', {
    type: 'Page',
    data: {title: 'On disk', intro: 'Before'}
  })
  const stored = await env.readEntry(created.file)
  // Edited outside of alinea, without the file watcher running
  await writeFile(
    join(env.rootDir, created.file),
    JSON.stringify({...stored, intro: 'After'}, null, 2)
  )
  const read = await env.ok('get_entry', {id: created.id})
  test.is(read.data.intro, 'After')
})

test('code blocks round trip through Markdown fences', async () => {
  await using env = await setup()
  const created = await env.ok('create_entry', {
    type: 'Page',
    data: {title: 'Code', body: 'Intro with `inline` code'}
  })
  const stored = await env.readEntry(created.file)
  // Written by hand with the id first
  const block = {
    _id: 'block1',
    _type: 'CodeBlock',
    code: 'let a',
    language: 'ts'
  }
  // Written by the dashboard's editor, with an alignment Markdown can't hold
  const [paragraph] = stored.body
  stored.body = [
    {_type: 'paragraph', textAlign: 'left', content: paragraph.content}
  ]
  await env.writeText(
    created.file,
    JSON.stringify({...stored, body: [...stored.body, block]}, null, 2)
  )
  const before = await env.readText(created.file)
  const read = await env.ok('get_entry', {id: created.id})
  test.is(
    read.data.body,
    'Intro with `inline` code\n\n```ts id=block1\nlet a\n```'
  )
  await env.ok('update_entry', {id: created.id, data: {body: read.data.body}})
  test.is(await env.readText(created.file), before)
  await env.ok('update_entry', {
    id: created.id,
    data: {body: String(read.data.body).replace('let a', 'let b')}
  })
  const [intro, changed] = (await env.readEntry(created.file)).body
  test.equal(intro, stored.body[0])
  test.equal(Object.keys(changed), ['_id', '_type', 'code', 'language'])
  test.is(changed.code, 'let b')
  test.is(intro.content[0].text, 'Intro with `inline` code')
  await env.ok('update_entry', {
    id: created.id,
    data: {body: String(read.data.body).replace('Intro', 'An intro')}
  })
  const [edited] = (await env.readEntry(created.file)).body
  test.equal(edited, {
    _type: 'paragraph',
    textAlign: 'left',
    content: [{_type: 'text', text: 'An intro with `inline` code'}]
  })
})
