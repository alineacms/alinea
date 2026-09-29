import {createCMS, Entry} from '#/core.js'
import {WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {MemorySource} from '#/core/source/MemorySource.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'
import {EntryStore} from './EntryStore.js'

const test = suite(import.meta)

const Page = Config.type('Page', {
  contains: ['Page'],
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path')
  }
})

const cms = createCMS({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content/main',
      roots: {
        pages: Config.root('Pages', {contains: ['Page']})
      }
    }),
    international: Config.workspace('International', {
      source: 'content/international',
      roots: {
        articles: Config.root('Articles', {
          contains: ['Page'],
          i18n: {locales: ['en', 'nl', 'fr']}
        })
      }
    })
  }
})

async function createDb() {
  const db = await EntryStore.memory(cms.config, new MemorySource())
  await db.sync()
  await db.mutate([
    {
      op: 'create',
      id: 'article',
      type: 'Page',
      locale: 'en',
      workspace: 'international',
      root: 'articles',
      data: {title: 'Article'}
    }
  ])
  return db
}

function translator() {
  const policy = new WriteablePolicy(getScope(cms.config))
  policy.set(
    {allow: {read: true}},
    {locale: 'nl', allow: {create: true, update: true, publish: true}},
    {locale: 'fr', allow: {create: true, update: true, publish: true}}
  )
  return policy
}

async function rejects(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    return error as Error
  }
  throw new Error('Expected a rejection')
}

test('a locale scoped role can create a translation', async () => {
  const db = await createDb()
  const request = await db.request(
    [
      {
        op: 'create',
        id: 'article',
        type: 'Page',
        locale: 'nl',
        data: {title: 'Artikel'}
      }
    ],
    translator()
  )
  test.ok(request.changes.length > 0)
})

test('a locale scoped role cannot create outside its locales', async () => {
  const db = await createDb()
  const error = await rejects(() =>
    db.request(
      [
        {
          op: 'create',
          id: 'other',
          type: 'Page',
          locale: 'en',
          workspace: 'international',
          root: 'articles',
          data: {title: 'Other'}
        }
      ],
      translator()
    )
  )
  test.is(error.message, 'Permission denied')
})

test('create under a parent takes its workspace and root', async () => {
  const db = await createDb()
  await db.mutate([
    {
      op: 'create',
      id: 'child',
      type: 'Page',
      locale: 'en',
      parentId: 'article',
      data: {title: 'Child'}
    }
  ])
  const child = await db.first({
    id: 'child',
    locale: 'en',
    status: 'all',
    select: {
      workspace: Entry.workspace,
      root: Entry.root,
      parentId: Entry.parentId
    }
  })
  test.equal(child, {
    workspace: 'international',
    root: 'articles',
    parentId: 'article'
  })
})

test('create under a parent rejects a different workspace or root', async () => {
  const db = await createDb()
  const error = await rejects(() =>
    db.mutate([
      {
        op: 'create',
        id: 'child',
        type: 'Page',
        locale: null,
        workspace: 'main',
        root: 'pages',
        parentId: 'article',
        data: {title: 'Child'}
      }
    ])
  )
  test.ok(error.message.includes('parent'))
})

test('permissions scoped to a parent apply to creating children', async () => {
  const db = await createDb()
  const policy = new WriteablePolicy(getScope(cms.config))
  policy.set({allow: {read: true}}, {id: 'article', allow: {create: true}})
  const request = await db.request(
    [
      {
        op: 'create',
        id: 'child',
        type: 'Page',
        locale: 'en',
        parentId: 'article',
        data: {title: 'Child'}
      }
    ],
    policy
  )
  test.ok(request.changes.length > 0)
})
