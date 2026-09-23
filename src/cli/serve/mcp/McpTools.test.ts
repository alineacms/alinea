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
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'
import {DevDB} from '../../generate/DevDB.js'
import {LocalAuth} from '../LocalAuth.js'
import {MemoryDrafts} from '../MemoryDrafts.js'
import {createDevMcp} from './DevMcp.js'

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

const Feature = Config.type('Feature', {
  fields: {
    title: Field.text('Title'),
    link: Field.link('Link')
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

const Post = Config.document('Post', {fields: {}})

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
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-mcp-'))
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
  const handleMcp = createDevMcp({
    config: cms.config,
    db,
    rootDir,
    user,
    handleApi(request) {
      return handler(request, {
        isDev: true,
        handlerUrl: new URL(`${origin}/api`),
        apiKey: 'dev'
      })
    }
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
  return {
    rootDir,
    call,
    ok,
    readEntry,
    async [Symbol.asyncDispose]() {
      await db.close()
      await rm(rootDir, {recursive: true, force: true})
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
  const byKey = Object.fromEntries(
    page.fields.map((field: {key: string}) => [field.key, field])
  )
  test.is(byKey.title.kind, 'text')
  test.is(byKey.title.required, true)
  test.is(byKey.title.tab, 'Document')
  test.equal(byKey.body.blocks, {CodeBlock: 'CodeBlock', Notice: 'Notice'})
  test.equal(byKey.features.blocks, {Feature: 'Feature'})
  test.equal(byKey.related.linkTypes, ['entry'])
  test.is(byKey.related.multiple, true)
  test.equal(byKey.color.options, {red: 'Red', blue: 'Blue'})
  test.equal(byKey.tagline.locales, ['en', 'nl'])
  test.is(byKey.seo.fields[0].key, 'keywords')
  test.is(schema.blocks.Notice.fields[1].kind, 'richText')
  const single = await env.ok('describe_schema', {type: 'Post'})
  test.is(single.type.name, 'Post')
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
  const ambiguous = await env.call('get_entry', {id: en.id})
  test.is(ambiguous.isError, true)
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
    const outside = await env.call('upload_file', {path: '../secret.jpg'})
    test.ok(outside.text.includes('outside the project directory'))
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
    test.is(stored._type, 'MediaFile')
    test.is(typeof stored.thumbHash, 'string')
    test.is(typeof stored.averageColor, 'string')
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
  } finally {
    globalThis.fetch = fetch
  }
})
