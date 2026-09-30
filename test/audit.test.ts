import {suite} from '@alinea/suite'
import {Entry} from '#/core/Entry.js'
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
