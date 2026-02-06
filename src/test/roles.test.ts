import {suite} from '@alinea/suite'
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
import {Policy, WriteablePolicy} from 'alinea/core/Role.js'
import {getScope} from 'alinea/core/Scope.js'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {create, move, update} from 'alinea/core/db/Operation.js'

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
  schema: {Page, Restricted, SubPage},
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
    after: childB._id
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
    toParent: targetParent._id
  }).task(db)
  await test.throws(() => db.request(moveMutation, policy), 'denied')
})
