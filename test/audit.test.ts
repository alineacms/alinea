import {suite} from '@alinea/suite'
import {create, update} from '#/core/db/Operation.js'
import {Entry} from '#/core/Entry.js'
import {WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {
    title: Field.text('Title'),
    path: Field.path('Path'),
    metadata: Field.metadata()
  }
})

const config = Config.create({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: '.',
      roots: {pages: Config.root('Pages', {contains: ['Page']})}
    })
  }
})

const jane = {sub: 'jane', name: 'Jane', email: 'jane@example.com'}
const john = {sub: 'john', name: 'John', email: 'john@example.com'}
const nobody = {name: '', email: ''}

async function createDB() {
  const db = new LocalDB(config)
  await db.sync()
  return db
}

test('creates record when and by whom the entry was created', async () => {
  const db = await createDB()
  const entry = await db.create({type: Page, set: {title: 'A'}, user: jane})
  const {metadata} = entry
  test.ok(typeof metadata.createdAt === 'number')
  test.equal(metadata.createdBy, {name: 'Jane', email: 'jane@example.com'})
  test.is(metadata.updatedAt, metadata.createdAt)
  test.equal(metadata.updatedBy, metadata.createdBy)
})

test('creates without a user record an unknown creator', async () => {
  const db = await createDB()
  const entry = await db.create({type: Page, set: {title: 'A'}})
  test.ok(typeof entry.metadata.createdAt === 'number')
  test.equal(entry.metadata.createdBy, nobody)
  test.equal(entry.metadata.updatedBy, nobody)
})

test('creates without a user keep the audit details the caller provides', async () => {
  const db = await createDB()
  const imported = await db.create({
    type: Page,
    set: {
      title: 'Imported',
      metadata: {
        createdAt: 100,
        createdBy: {name: 'Ann', email: 'ann@example.com'},
        updatedAt: 200,
        updatedBy: {name: 'Bob', email: ''}
      }
    }
  })
  test.is(imported.metadata.createdAt, 100)
  test.equal(imported.metadata.createdBy, {
    name: 'Ann',
    email: 'ann@example.com'
  })
  test.is(imported.metadata.updatedAt, 200)
  test.equal(imported.metadata.updatedBy, {name: 'Bob', email: ''})
})

test('updates record who last updated the entry and keep its creation', async () => {
  const db = await createDB()
  const created = await db.create({
    type: Page,
    set: {title: 'A', metadata: {title: 'SEO title'}},
    user: jane
  })
  const updated = await db.update({
    type: Page,
    id: created._id,
    set: {title: 'B'},
    user: john
  })
  test.is(updated.title, 'B')
  test.is(updated.metadata.title, 'SEO title')
  test.is(updated.metadata.createdAt, created.metadata.createdAt)
  test.equal(updated.metadata.createdBy, created.metadata.createdBy)
  test.ok(updated.metadata.updatedAt! >= created.metadata.createdAt!)
  test.equal(updated.metadata.updatedBy, {
    name: 'John',
    email: 'john@example.com'
  })

  // Without a user the last editor is unknown
  const anonymous = await db.update({
    type: Page,
    id: created._id,
    set: {title: 'C'}
  })
  test.equal(anonymous.metadata.createdBy, created.metadata.createdBy)
  test.equal(anonymous.metadata.updatedBy, nobody)
})

test('updates of a draft stamp the draft', async () => {
  const db = await createDB()
  const created = await db.create({
    type: Page,
    set: {title: 'A'},
    status: 'draft',
    user: jane
  })
  await db.update({
    id: created._id,
    set: {title: 'B'},
    status: 'draft',
    user: john
  })
  const draft = await db.get({
    id: created._id,
    status: 'draft',
    select: Entry.data
  })
  test.equal(draft.metadata.createdBy, created.metadata.createdBy)
  test.equal(draft.metadata.updatedBy, {
    name: 'John',
    email: 'john@example.com'
  })
})

test('audit stamps do not need an update permission on the metadata field', async () => {
  const db = await createDB()
  const created = await db.create({
    type: Page,
    set: {title: 'A', metadata: {title: 'SEO title'}},
    user: jane
  })
  // A role that may only update the title
  const policy = new WriteablePolicy(getScope(config))
    .allowAll()
    .set({field: Page.path, deny: {update: true}})
    .set({field: Page.metadata, deny: {update: true}})
  const resource = {type: 'Page', workspace: 'main', root: 'pages'}
  test.ok(policy.canUpdate({...resource, field: 'title'}))
  test.not.ok(policy.canUpdate({...resource, field: 'metadata'}))
  const commit = async (mutations: Awaited<ReturnType<typeof edit.task>>) =>
    db.write(await db.request(mutations, policy))
  const edit = update({
    type: Page,
    id: created._id,
    set: {title: 'B'},
    user: john
  })

  // Updating the title stamps who updated the entry
  await commit(await edit.task(db))
  const updated = await db.get({type: Page, id: created._id})
  test.is(updated.title, 'B')
  test.equal(updated.metadata.updatedBy, {
    name: 'John',
    email: 'john@example.com'
  })
  test.equal(updated.metadata.createdBy, created.metadata.createdBy)

  // Other metadata, such as its aliases or SEO title, stays checked
  const aliases = update({
    type: Page,
    id: created._id,
    set: {
      metadata: {
        ...updated.metadata,
        aliases: [{_id: 'a', _type: 'alias', _index: 'a0', url: '/old'}]
      }
    },
    user: john
  })
  await test.throws(async () => commit(await aliases.task(db)), 'denied')
  const seo = update({
    type: Page,
    id: created._id,
    set: {metadata: {...updated.metadata, title: 'Other'}},
    user: john
  })
  await test.throws(async () => commit(await seo.task(db)), 'denied')

  // Saves like the dashboard's, the whole entry at once, still go through
  const data = await db.get({id: created._id, select: Entry.data})
  await commit(
    await create({
      type: Page,
      id: created._id,
      set: {...data, title: 'C'},
      overwrite: true,
      user: jane
    }).task(db)
  )
  const saved = await db.get({type: Page, id: created._id})
  test.is(saved.title, 'C')
  test.is(saved.metadata.title, 'SEO title')
  test.equal(saved.metadata.updatedBy, {
    name: 'Jane',
    email: 'jane@example.com'
  })
})
