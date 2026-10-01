import {createCMS} from '#/core.js'
import {Policy, WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {LocalDB} from '#/database/LocalDB.js'
import {create, move, publish, update} from '#/core/db/Operation.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {Entry} from '#/core/Entry.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {}
})
const SubPage = Config.document('Page', {
  fields: {
    x: Field.text('X')
  }
})
const Restricted = Config.document('Restricted', {
  contains: [SubPage],
  fields: {}
})
const Article = Config.document('Article', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    summary: Field.text('Summary'),
    metadata: Field.metadata()
  }
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {
    pages: Config.root('Pages', {
      children: {
        seeded1: Config.page({
          type: Page
        })
      }
    })
  }
})
const cms = createCMS({
  schema: {Page, Restricted, SubPage, Article},
  workspaces: {main}
})

test('enforce permissions', async () => {
  const db = new LocalDB(cms.config)
  const mutations = await create({
    type: Page,
    root: 'pages',
    workspace: 'main',
    set: {title: 'Test Page'}
  }).task(db)
  await test.throws(() => db.request(mutations, Policy.ALLOW_NONE), 'denied')
})

test('enforce field update permissions', async () => {
  const db = new LocalDB(cms.config)
  const createSubPage = create({
    type: SubPage,
    root: 'pages',
    workspace: 'main',
    set: {title: 'Sub page', x: 'before'}
  })
  await db.mutate(await createSubPage.task(db))

  const policy = new WriteablePolicy(getScope(cms.config))
  policy.allowAll()
  policy.set({field: SubPage.x, deny: {update: true}})

  const denyUpdate = await update({
    type: SubPage,
    id: createSubPage.id,
    locale: null,
    status: 'published',
    set: {x: 'after'}
  }).task(db)
  await test.throws(() => db.request(denyUpdate, policy), 'denied')

  const allowOtherField = await update({
    type: SubPage,
    id: createSubPage.id,
    locale: null,
    status: 'published',
    set: {title: 'Updated title'}
  }).task(db)
  await db.request(allowOtherField, policy)
})

test('enforce reorder permissions', async () => {
  const db = new LocalDB(cms.config)
  const parent = await db.create({
    type: Page,
    root: 'pages',
    workspace: 'main',
    set: {title: 'Parent'}
  })
  const childA = await db.create({
    type: Page,
    parentId: parent._id,
    set: {title: 'A'}
  })
  const childB = await db.create({
    type: Page,
    parentId: parent._id,
    set: {title: 'B'}
  })

  const policy = new WriteablePolicy(getScope(cms.config))
  policy.allowAll()
  policy.set({id: childA._id, deny: {reorder: true}})

  const reorder = await move({
    id: childA._id,
    target: childB._id,
    dropPosition: 'after'
  }).task(db)
  await test.throws(() => db.request(reorder, policy), 'denied')
})

test('enforce move permissions', async () => {
  const db = new LocalDB(cms.config)
  const sourceParent = await db.create({
    type: Page,
    root: 'pages',
    workspace: 'main',
    set: {title: 'Source'}
  })
  const targetParent = await db.create({
    type: Page,
    root: 'pages',
    workspace: 'main',
    set: {title: 'Target'}
  })
  const child = await db.create({
    type: Page,
    parentId: sourceParent._id,
    set: {title: 'Child'}
  })

  const policy = new WriteablePolicy(getScope(cms.config))
  policy.allowAll()
  policy.set({id: child._id, deny: {move: true}})

  const moveMutation = await move({
    id: child._id,
    target: targetParent._id,
    dropPosition: 'on'
  }).task(db)
  await test.throws(() => db.request(moveMutation, policy), 'denied')
})

/** A role that may only update the title of an article */
function titleEditor() {
  return new WriteablePolicy(getScope(cms.config))
    .allowAll()
    .set({field: Article.path, deny: {update: true}})
    .set({field: Article.summary, deny: {update: true}})
    .set({field: Article.metadata, deny: {update: true}})
}

async function createArticle() {
  const db = new LocalDB(cms.config)
  const article = await db.create({
    type: Article,
    root: 'pages',
    workspace: 'main',
    set: {title: 'Article', summary: 'Summary', metadata: {title: 'SEO'}}
  })
  const data = await db.get({id: article._id, select: Entry.data})
  const commit = async (mutations: Array<Mutation>) =>
    db.write(await db.request(mutations, titleEditor()))
  return {db, id: article._id, data, commit}
}

const jane = {sub: 'jane', name: 'Jane', email: 'jane@example.com'}

test('saves over an entry check the fields they change', async () => {
  const {db, id, data, commit} = await createArticle()
  const save = (set: Record<string, unknown>, status?: 'draft') =>
    create({type: Article, id, set, status, overwrite: true, user: jane}).task(
      db
    )

  // Changing only the title goes through and stamps who saved it
  await commit(await save({...data, title: 'Title only'}))
  const saved = await db.get({type: Article, id})
  test.is(saved.title, 'Title only')
  test.equal(saved.metadata.updatedBy, {name: 'Jane', email: jane.email})

  // A field the role may not update is refused like an update would be,
  // leaving it out of the save replaces it as well
  await test.throws(
    async () => commit(await save({title: 'Without summary'})),
    'Permission denied'
  )
  await test.throws(
    async () => commit(await save({...data, summary: 'Other'})),
    'Permission denied'
  )
  await test.throws(
    async () => commit(await save({...data, summary: 'Other'}, 'draft')),
    'Permission denied'
  )

  // The dashboard's save: the whole entry, its path and metadata included
  const current = await db.get({id, select: Entry.data})
  await commit(await save({...current, title: 'Dashboard'}))
  const dashboard = await db.get({type: Article, id})
  test.is(dashboard.title, 'Dashboard')
  test.is(dashboard.summary, 'Summary')
  test.is(dashboard.metadata.title, 'SEO')
})

test('a new draft of an entry checks the fields it changes', async () => {
  const {db, id, data, commit} = await createArticle()
  const draft = create({
    type: Article,
    id,
    status: 'draft',
    set: {...data, summary: 'Other'}
  })
  await test.throws(
    async () => commit(await draft.task(db)),
    'Permission denied'
  )
})

test('publishing a draft relies on the checks of its saves', async () => {
  const {db, id, data, commit} = await createArticle()
  // Drafted by someone who may change the summary
  await db.create({
    type: Article,
    id,
    status: 'draft',
    set: {...data, summary: 'Drafted'},
    overwrite: true
  })
  await commit(await publish({id, locale: null, status: 'draft'}).task(db))
  const published = await db.get({type: Article, id})
  test.is(published.summary, 'Drafted')
})
