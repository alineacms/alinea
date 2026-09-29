import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {basename, dirname, join} from 'node:path'
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

const Variant = Config.type('Variant', {
  fields: {
    name: Field.text('Name'),
    code: Field.code('Code')
  }
})

const Tabs = Config.type('Tabs', {
  fields: {
    variants: Field.list('Variants', {schema: {Variant}}),
    link: Field.entry('Link'),
    related: Field.entry.multiple('Related')
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
    body: Field.richText('Body', {schema: {CodeBlock, Notice, Tabs}}),
    features: Field.list('Features', {schema: {Feature}, max: 3}),
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
        sorted: Config.root('Sorted', {
          contains: ['Post'],
          overview: {sort: {desc: Entry.title}}
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
    apiKey: 'dev',
    handleApi
  })
  // Writes the way the dashboard does, for comparisons
  const graph = new McpGraph({
    config: cms.config,
    db,
    handle: handleApi,
    handlerUrl: `${origin}/api`,
    apiKey: 'dev'
  })
  let id = 0
  async function rpc(method: string, params?: object) {
    const response = await handleMcp(
      new Request(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream'
        },
        body: JSON.stringify({jsonrpc: '2.0', id: ++id, method, params})
      })
    )
    return response.json()
  }
  async function call(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const body = await rpc('tools/call', {name, arguments: args})
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
    rpc,
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

/** Stand in for the dev server's upload endpoint */
function stubUploads(rootDir: string) {
  const fetch = globalThis.fetch
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      // The dev server's upload endpoint requires the key without an Origin
      test.is(new Headers(init?.headers).get('x-alinea-dev-key'), 'dev')
      const location = join(rootDir, url.searchParams.get('file')!)
      await mkdir(dirname(location), {recursive: true})
      await writeFile(location, new Uint8Array(init!.body as ArrayBuffer))
      return new Response('Upload ok')
    },
    {preconnect: fetch.preconnect}
  )
  return {
    [Symbol.dispose]() {
      globalThis.fetch = fetch
    }
  }
}

test('an agent session over JSON-RPC', async () => {
  await using env = await setup()
  using _uploads = stubUploads(env.rootDir)
  const init = await env.rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: {name: 'test', version: '1'}
  })
  test.is(init.result.protocolVersion, '2025-06-18')
  test.ok(init.result.instructions.includes('describe_schema'))
  const {result} = await env.rpc('tools/list')
  test.equal(
    result.tools.map((tool: {name: string}) => tool.name),
    [
      'describe_schema',
      'find_entries',
      'get_entry',
      'create_entry',
      'update_entry',
      'publish_entry',
      'delete_entry',
      'move_entry',
      'upload_file'
    ]
  )
  const created = await env.ok('create_entry', {
    type: 'Page',
    data: {title: 'Session', body: 'Draft text'},
    publish: false
  })
  test.is(created.status, 'draft')
  await copyFile('test/fixtures/example.jpg', join(env.rootDir, 'photo.jpg'))
  const media = await env.ok('upload_file', {path: 'photo.jpg'})
  await env.ok('update_entry', {
    id: created.id,
    data: {image: media.id, body: 'Final **text**'},
    publish: false
  })
  await env.ok('publish_entry', {id: created.id})
  const found = await env.ok('find_entries', {search: 'Session'})
  test.is(found.entries[0].status, 'published')
  const read = await env.ok('get_entry', {id: created.id})
  test.is(read.data.body, 'Final **text**')
  test.is(read.data.image._entry, media.id)
  const refused = await env.call('delete_entry', {id: media.id})
  test.ok(refused.text.includes('Session'))
  await env.ok('delete_entry', {id: created.id})
  await env.ok('delete_entry', {id: media.id})
  test.is((await env.ok('find_entries', {})).total, 0)
})

interface Row {
  _id: string
  [field: string]: unknown
}

test('describe_schema', async () => {
  await using env = await setup()
  const schema = await env.ok('describe_schema', {})
  test.is(schema.enableDrafts, true)
  test.equal(schema.workspaces.main.blog, {
    locales: ['en', 'nl'],
    contains: ['Post']
  })
  test.is(schema.workspaces.main.media.media, true)
  const page = schema.types.Page
  test.equal(page.contains, ['Page'])
  test.is(page.fields.title, 'text (required)')
  test.is(page.fields.body, 'richText[CodeBlock|Notice|Tabs]')
  test.is(page.fields.features, 'list[Feature]')
  test.is(page.fields.related, 'links[entry]')
  test.is(page.fields.image, 'link[image]')
  test.is(page.fields.color, 'select[red|blue]')
  test.is(page.fields.seo, 'object[seo]')
  test.is(page.fields.tagline, 'localised[en|nl] text')
  test.is(schema.types.Post.fields.category, 'text (shared)')
  test.equal(schema.definitions.Feature, {
    title: 'text',
    link: 'link[entry|url|file]',
    items: 'list[Item]'
  })
  test.ok(schema.valueFormats.includes('richText: Markdown'))
  const post = await env.ok('describe_schema', {type: 'Post'})
  test.equal(Object.keys(post.types), ['Post'])
  test.is((await env.call('describe_schema', {type: 'Nope'})).isError, true)
})

test('create, read, update, publish and delete entries', async () => {
  await using env = await setup()
  const created = await env.ok('create_entry', {
    type: 'Page',
    data: {
      title: 'Hello world',
      intro: 'An intro',
      body: '# Welcome\n\nSome **bold** text.\n\n```ts\nconst a = 1\n```\n\n- one',
      features: [{title: 'Fast', link: 'https://alinea.sh'}],
      color: 'blue',
      seo: {keywords: 'cms'},
      tagline: {en: 'Hi'}
    }
  })
  test.is(created.url, '/hello-world')
  test.is(created.status, 'published')
  test.is(created.file, 'content/pages/hello-world.json')
  const stored = await env.readEntry(created.file)
  test.is(stored._id, created.id)
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
  test.is(feature.link._url, 'https://alinea.sh')

  // Links to entries, in fields and rich text
  const child = await env.ok('create_entry', {
    type: 'Page',
    parentId: created.id,
    data: {
      title: 'Child',
      related: [created.id],
      body: `See [the parent](entry:${created.id})`
    }
  })
  test.is(child.url, '/hello-world/child')
  const childData = await env.readEntry(child.file)
  test.is(childData.related[0]._entry, created.id)
  test.is(childData.related[0]._type, 'entry')
  test.is(childData.body[0].content[1].marks[0]._entry, created.id)

  // Read back with rich text as Markdown and the entries linking to it
  const read = await env.ok('get_entry', {id: child.id})
  test.is(read.data.body, `See [the parent](entry:${created.id})`)
  test.is(read.file, 'content/pages/hello-world/child.json')
  const parent = await env.ok('get_entry', {url: '/hello-world'})
  test.is(parent.id, created.id)
  test.equal(parent.versions, [{locale: null, status: 'published'}])
  test.equal(parent.referencedBy.map((link: {id: string}) => link.id).sort(), [
    child.id,
    child.id
  ])

  // Find
  const top = await env.ok('find_entries', {root: 'pages', parentId: null})
  test.is(top.total, 1)
  test.is(top.entries[0].children, 1)
  const searched = await env.ok('find_entries', {type: 'Page', search: 'Child'})
  test.is(searched.entries[0].id, child.id)

  // Updates change the given fields
  await env.ok('update_entry', {
    id: created.id,
    data: {intro: 'Changed', seo: {robots: 'noindex'}, tagline: {nl: 'Hoi'}}
  })
  const updated = await env.readEntry(created.file)
  test.is(updated.intro, 'Changed')
  test.equal(updated.seo, {keywords: 'cms', robots: 'noindex'})
  test.equal(updated.tagline, {en: 'Hi', nl: 'Hoi'})
  test.equal(updated.body, stored.body)
  test.equal(updated.features, stored.features)
  const same = await env.ok('update_entry', {
    id: created.id,
    data: {intro: 'Changed'}
  })
  test.is(same.note, 'No changes')

  // Drafts
  const draft = await env.ok('update_entry', {
    id: created.id,
    data: {intro: 'Draft intro'},
    publish: false
  })
  test.is(draft.status, 'draft')
  test.is(draft.file, 'content/pages/hello-world.draft.json')
  test.is((await env.readEntry(created.file)).intro, 'Changed')
  await env.ok('publish_entry', {id: created.id})
  test.is((await env.readEntry(created.file)).intro, 'Draft intro')
  const again = await env.ok('publish_entry', {id: created.id})
  test.is(again.note, 'Already published')

  // Deletes refuse while other entries link to the entry
  const refused = await env.call('delete_entry', {id: created.id})
  test.ok(refused.text.includes(`Child (${child.id}) field related`))
  await env.ok('delete_entry', {id: child.id})
  await test.throws(() => env.readEntry(child.file))
  await env.ok('delete_entry', {id: created.id})
  await test.throws(() => env.readEntry(created.file))
})

test('list rows and links merge into the current value', async () => {
  await using env = await setup()
  const target = await env.ok('create_entry', {
    type: 'Page',
    data: {title: 'Target'}
  })
  const created = await env.ok('create_entry', {
    type: 'Page',
    data: {
      title: 'Rows',
      features: [{title: 'One', items: [{text: 'a'}]}, {title: 'Two'}],
      related: [target.id]
    }
  })
  const [one, two] = (await env.readEntry(created.file)).features as Array<Row>
  const [link] = (await env.readEntry(created.file)).related as Array<Row>
  await env.ok('update_entry', {
    id: created.id,
    data: {
      // Reordered, the first row changed, a new row at the end
      features: [
        {_id: two._id},
        {_id: one._id, title: 'First'},
        {title: 'New'}
      ],
      related: [target.id]
    }
  })
  const {features, related} = await env.readEntry(created.file)
  test.equal(features[0], two)
  test.equal(features[1], {...one, title: 'First', _index: features[1]._index})
  test.ok(features[0]._index < features[1]._index)
  test.ok(features[1]._index < features[2]._index)
  test.is(features[2].title, 'New')
  test.equal(features[1].items, one.items)
  test.equal(related, [link])
})

test('errors name the field and what is expected', async () => {
  await using env = await setup()
  const error = async (data: Record<string, unknown>, type = 'Page') =>
    (await env.call('create_entry', {type, data: {title: 'x', ...data}})).text
  test.ok((await error({nope: 1})).startsWith('data.nope: unknown field'))
  test.is(
    await error({features: [{title: 3}]}),
    'data.features[0].title: expected a string'
  )
  test.is(
    await error({color: 'Green'}),
    'data.color: expected one of: red, blue'
  )
  test.is(
    await error({body: [{_type: 'Video'}]}),
    'data.body[0]: expected a _type, one of: CodeBlock, Notice, Tabs'
  )
  test.ok((await error({related: ['missing']})).startsWith('data.related.'))
  test.is(
    await error({}, 'Post'),
    'Type "Post" is not allowed in root "pages", allowed: Page'
  )
  // Validation of published entries is done by the transaction
  const tooMany = await error({features: [{}, {}, {}, {}]})
  test.ok(tooMany.includes('Add at most 3 items'))
})

test('translations, moves and archiving', async () => {
  await using env = await setup()
  const en = await env.ok('create_entry', {
    type: 'Post',
    root: 'blog',
    data: {title: 'Hello', category: 'News'}
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
  test.is((await env.readEntry(nl.file)).category, 'News')
  test.is((await env.ok('get_entry', {id: en.id})).locale, 'en')
  const dutch = await env.ok('get_entry', {id: en.id, locale: 'nl'})
  test.is(dutch.data.title, 'Hallo')

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
  await env.ok('publish_entry', {id: a.id, archive: true})
  test.is((await env.ok('get_entry', {id: a.id})).status, 'archived')
  await env.ok('publish_entry', {id: a.id})
  test.is((await env.ok('get_entry', {id: a.id})).status, 'published')
})

test('upload_file creates and replaces media entries', async () => {
  await using env = await setup()
  await copyFile('test/fixtures/example.jpg', join(env.rootDir, 'example.jpg'))
  using _uploads = stubUploads(env.rootDir)
  const outside = await env.call('upload_file', {path: '../../secret.jpg'})
  test.is(outside.isError, true)
  test.ok(outside.text.includes(join(env.repoDir, '..', 'secret.jpg')))
  // Hidden files and symlinks out of the project are refused
  await writeFile(join(env.rootDir, '.env'), 'SECRET=1')
  await mkdir(join(env.repoDir, '.git', 'objects'), {recursive: true})
  await writeFile(join(env.repoDir, '.git', 'objects', 'a.jpg'), 'git')
  const secret = join(env.repoDir, '..', `${basename(env.repoDir)}.jpg`)
  await writeFile(secret, 'secret')
  await symlink(secret, join(env.rootDir, 'link.jpg'))
  try {
    for (const hidden of ['.env', '../.git/objects/a.jpg', 'link.jpg'])
      test.is((await env.call('upload_file', {path: hidden})).isError, true)
  } finally {
    await rm(secret)
  }
  const media = await env.ok('upload_file', {
    path: 'example.jpg',
    title: 'A photo',
    alt: 'A description'
  })
  test.is(media.title, 'A photo')
  test.ok(String(media.location).startsWith('/a-photo.'))
  const stored = await env.readEntry(media.file)
  test.is(stored._type, 'MediaFile')
  test.is(stored.alt, 'A description')
  test.ok(stored.width > 0)
  test.is(typeof stored.thumbHash, 'string')
  // The same fields as a dashboard upload of the same file
  const viaDashboard = await env.readEntry(
    join(
      'content',
      await env.dashboardUpload(
        new File([await readFile('test/fixtures/example.jpg')], 'A photo.jpg')
      )
    )
  )
  test.equal(
    Object.keys(stored).sort(),
    [...Object.keys(viaDashboard), 'alt'].sort()
  )
  await readFile(join(env.rootDir, 'public/media', media.location))

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
  test.ok(wrong.text.includes('upload_file returns media ids'))

  // Into a folder, from the enclosing repository
  const folder = await env.ok('create_entry', {
    type: 'MediaLibrary',
    root: 'media',
    data: {title: 'Photos'}
  })
  await copyFile('test/fixtures/example.jpg', join(env.repoDir, 'scratch.jpg'))
  const photo = await env.ok('upload_file', {
    path: join(env.repoDir, 'scratch.jpg'),
    parentId: folder.id
  })
  test.is(photo.file, 'content/media/photos/scratch.json')

  // Replacing keeps the id, title and alt text, recomputes the rest
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
    replace: media.id
  })
  test.is(replaced.id, media.id)
  test.ok(replaced.location !== media.location)
  await test.throws(() =>
    readFile(join(env.rootDir, 'public/media', media.location))
  )
  const replacedData = await env.readEntry(replaced.file)
  test.is(replacedData.title, 'A photo')
  test.is(replacedData.alt, 'A description')
  test.is(replacedData.width, 20)
  const notMedia = await env.call('upload_file', {
    path: 'red.png',
    replace: page.id
  })
  test.ok(notMedia.text.includes('is not a MediaFile entry'))
})

test('writes match the dashboard for the same edit', async () => {
  await using env = await setup()
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
      {intro: 'Changed', seo: {robots: 'noindex'}},
      value => {
        value.intro = 'Changed'
        value.seo = {...(value.seo as object), robots: 'noindex'}
      }
    ],
    [
      {features: [{_id: rows[0]._id}, {_id: rows[1]._id, title: 'Second'}]},
      value => {
        const features = value.features as Array<Row>
        features[1] = {...features[1], title: 'Second'}
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
})

test('rich text round trips through Markdown', async () => {
  await using env = await setup()
  const created = await env.ok('create_entry', {
    type: 'Page',
    data: {title: 'Code', body: 'Intro with `inline` code'}
  })
  const stored = await env.readEntry(created.file)
  const notice = {_id: 'notice1', _type: 'Notice', level: 'info', text: []}
  const code = {
    _id: 'block1',
    _type: 'CodeBlock',
    code: 'let a',
    language: 'ts'
  }
  await env.writeText(
    created.file,
    JSON.stringify({...stored, body: [...stored.body, code, notice]}, null, 2)
  )
  const before = await env.readText(created.file)
  const read = await env.ok('get_entry', {id: created.id})
  test.ok(
    read.data.body.startsWith(
      'Intro with `inline` code\n\n```ts id=block1\nlet a\n```\n\n```alinea-block\n'
    )
  )
  // Sending it back unchanged changes nothing
  await env.ok('update_entry', {id: created.id, data: {body: read.data.body}})
  test.is(await env.readText(created.file), before)
  await env.ok('update_entry', {
    id: created.id,
    data: {body: String(read.data.body).replace('let a', 'let b')}
  })
  const [, changed, block] = (await env.readEntry(created.file)).body
  test.equal(changed, {...code, code: 'let b'})
  test.equal(block, notice)
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
