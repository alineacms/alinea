import {composeBackend} from '#/backend/api/CreateBackend.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import type {AuthedContext, RequestContext} from '#/core/Connection.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {CreateOp} from '#/core/db/Operation.js'
import {Entry} from '#/core/Entry.js'
import type {Type as TypeDefinition} from '#/core/Type.js'
import {Type} from '#/core/Type.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'
import {createStore} from 'jotai'

const test = suite(import.meta)

const main = Config.workspace('Main', {
  source: 'content',
  roots: {pages: Config.root('Pages')}
})

const Row = Config.type('Row', {fields: {text: Field.text('Text')}})

const fields = {
  body: Field.text('Body', {multiline: true}),
  rows: Field.list('Rows', {schema: {Row}})
}

/** The schema a server runs after a deploy */
const NewPage = Config.document('Page', {
  renamed: {subtitle: 'tagline'},
  fields: {
    ...fields,
    tagline: Field.text('Tagline'),
    extra: Field.text('Extra')
  }
})

/** The schema of a dashboard opened before that deploy */
const OldPage = Config.document('Page', {
  fields: {...fields, subtitle: Field.text('Subtitle')}
})

interface Server {
  remote: LocalDB
  mutate(mutations: Array<Mutation>): Promise<Response>
}

async function server(seed: Record<string, unknown>): Promise<Server> {
  const cms = createCMS({schema: {Page: NewPage}, workspaces: {main}})
  const remote = new LocalDB(cms.config)
  await remote.create({type: NewPage, id: 'home', set: seed as any})
  const handle = createHandler({
    cms,
    db: new LocalDB(cms.config),
    remote(context) {
      return composeBackend(remote, {
        async verify(): Promise<AuthedContext> {
          return {
            ...context,
            token: 'test',
            user: {roles: ['admin'], sub: 'admin'}
          }
        }
      })
    }
  })
  return {
    remote,
    async mutate(mutations) {
      const request = new Request('http://localhost/api?action=mutate', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify(mutations)
      })
      return handle(request, context)
    }
  }
}

const context: RequestContext = {
  apiKey: 'test',
  handlerUrl: new URL('http://localhost/api'),
  isDev: true
}

/**
 * An editor in the dashboard: reads the entry as its schema sees it into
 * the form, edits it there and saves what the form holds with its base.
 */
async function editor(remote: LocalDB, type: TypeDefinition) {
  const config = Config.create({schema: {Page: type}, workspaces: {main}})
  const db = new LocalDB(config)
  await db.syncWith(remote)
  const data = await db.get({id: 'home', select: Entry.data})
  const store = createStore()
  const node = new ReactiveNode<Record<string, unknown>>(
    Type.withInitialValue(type, {...Type.initialValue(type), ...data})
  )
  return {
    edit(field: string, value: unknown) {
      store.set(node.field(field), value)
    },
    async save(withBase = true): Promise<Array<Mutation>> {
      const op = new CreateOp({
        type,
        id: 'home',
        locale: null,
        status: 'published',
        set: store.get(node.value),
        overwrite: true,
        base: withBase ? store.get(node.initial) : undefined
      })
      return op.task(db)
    }
  }
}

async function stored(remote: LocalDB) {
  return remote.get({id: 'home', select: Entry.data})
}

test('a save from an older base keeps what was saved meanwhile', async () => {
  const {remote, mutate} = await server({title: 'Home', body: 'Hello'})
  const ada = await editor(remote, NewPage)
  const bob = await editor(remote, NewPage)
  ada.edit('title', 'Welcome')
  test.is((await mutate(await ada.save())).status, 200)
  bob.edit('body', 'Hello world')
  test.is((await mutate(await bob.save())).status, 200)
  const data = await stored(remote)
  test.is(data.title, 'Welcome')
  test.is(data.body, 'Hello world')
})

test('a save without a base replaces the entry as before', async () => {
  const {remote, mutate} = await server({title: 'Home', body: 'Hello'})
  const ada = await editor(remote, NewPage)
  const bob = await editor(remote, NewPage)
  ada.edit('title', 'Welcome')
  await mutate(await ada.save())
  bob.edit('body', 'Hello world')
  await mutate(await bob.save(false))
  const data = await stored(remote)
  test.is(data.title, 'Home')
  test.is(data.body, 'Hello world')
})

test('rows added and edited by two saves are both kept', async () => {
  const row = (id: string, index: string, text: string) => ({
    _id: id,
    _index: index,
    _type: 'Row',
    text
  })
  const {remote, mutate} = await server({
    title: 'Home',
    rows: [row('a', 'a0', 'A')]
  })
  const ada = await editor(remote, NewPage)
  const bob = await editor(remote, NewPage)
  ada.edit('rows', [row('a', 'a0', 'A edited')])
  await mutate(await ada.save())
  bob.edit('rows', [row('a', 'a0', 'A'), row('b', 'a1', 'B')])
  await mutate(await bob.save())
  const data = await stored(remote)
  test.equal(data.rows, [row('a', 'a0', 'A edited'), row('b', 'a1', 'B')])
})

test('a save on an older schema keeps fields only the newer one has', async () => {
  const {remote, mutate} = await server({title: 'Home', extra: 'Kept'})
  const old = await editor(remote, OldPage)
  old.edit('title', 'Welcome')
  test.is((await mutate(await old.save())).status, 200)
  const data = await stored(remote)
  test.is(data.title, 'Welcome')
  test.is(data.extra, 'Kept')
})

test('a field only the newer schema has keeps what others saved', async () => {
  const {remote, mutate} = await server({title: 'Home', extra: 'Kept'})
  const old = await editor(remote, OldPage)
  const current = await editor(remote, NewPage)
  current.edit('extra', 'Changed')
  await mutate(await current.save())
  old.edit('title', 'Welcome')
  await mutate(await old.save())
  const data = await stored(remote)
  test.is(data.title, 'Welcome')
  test.is(data.extra, 'Changed')
})

test('an edit under a renamed field lands in its new name', async () => {
  const {remote, mutate} = await server({title: 'Home', tagline: 'Stored'})
  const old = await editor(remote, OldPage)
  old.edit('subtitle', 'Edited')
  await mutate(await old.save())
  const data = await stored(remote)
  test.is(data.tagline, 'Edited')
  test.not.ok('subtitle' in data)
})

test('an entry stored under the old name moves to the new one on an edit', async () => {
  const {remote, mutate} = await server({title: 'Home', subtitle: 'Old'})
  const old = await editor(remote, OldPage)
  old.edit('subtitle', 'Edited')
  await mutate(await old.save())
  const data = await stored(remote)
  test.is(data.tagline, 'Edited')
  test.not.ok('subtitle' in data)
})

test('the form keeps fields its schema does not know as it read them', async () => {
  const {remote, mutate} = await server({title: 'Home', extra: 'Kept'})
  const old = await editor(remote, OldPage)
  old.edit('title', 'Welcome')
  await mutate(await old.save(false))
  const data = await stored(remote)
  test.is(data.title, 'Welcome')
  test.is(data.extra, 'Kept')
})
