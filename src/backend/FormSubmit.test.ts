import {SubmissionStore} from '#/backend/api/SubmissionStore.js'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import {MissingCredentialsError} from '#/backend/Auth.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import type {AuthedContext, RequestContext} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field, Form} from '#/index.js'
import {Database as BunSqlite} from 'bun:sqlite'
import {expect, test} from 'bun:test'
import * as driver from 'rado/driver'

const Contact = Config.document('Contact', {
  fields: {inputs: Field.form('Inputs', {inputs: Form.defaults})}
})

const main = Config.workspace('Main', {
  source: 'content',
  roots: {forms: Config.root('Forms')}
})

const rows = [
  {_id: 'name', _index: 'a0', _type: 'text', label: 'Name', required: true},
  {_id: 'mail', _index: 'a1', _type: 'email', label: 'Email', required: true}
]

async function setup() {
  const cms = createCMS({schema: {Contact}, workspaces: {main}})
  const db = new LocalDB(cms.config)
  await db.create({type: Contact, set: {title: 'Contact', inputs: rows}})
  const entryId = (await db.first({select: Entry.id, type: Contact}))!
  const store = new SubmissionStore({
    db: driver['bun:sqlite'](new BunSqlite(':memory:'))
  })
  const handle = createHandler({
    cms,
    db,
    remote() {
      return composeBackend(db, store, {
        async verify(): Promise<AuthedContext> {
          throw new MissingCredentialsError('Missing user credentials')
        }
      })
    }
  })
  async function submit(data: Record<string, string>, key = 'test') {
    const response = await handle(
      new Request('http://localhost/api?action=submit', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${key}`
        },
        body: JSON.stringify({entryId, data: Object.entries(data)})
      }),
      context
    )
    return {status: response.status, body: await response.json()}
  }
  return {entryId, store, submit}
}

const context: RequestContext = {
  apiKey: 'test',
  handlerUrl: new URL('http://localhost/api'),
  isDev: false
}

test('valid answers are stored with the form as it was sent', async () => {
  const {entryId, store, submit} = await setup()
  const result = await submit({name: 'Ann', email: 'ann@example.com'})
  expect(result).toEqual({status: 200, body: {ok: true}})
  const [stored] = await store.listSubmissions(entryId)
  expect(stored.values).toEqual({name: 'Ann', email: 'ann@example.com'})
  expect(stored.field).toBe('inputs')
  expect((stored.definition as Array<{key: string}>).map(i => i.key)).toEqual([
    'name',
    'email'
  ])
})

test('invalid answers return their errors and are not stored', async () => {
  const {entryId, store, submit} = await setup()
  const result = await submit({email: 'ann'})
  expect(result.body).toEqual({
    ok: false,
    errors: {name: 'Fill in this field', email: 'Use a valid email address'}
  })
  expect(await store.listSubmissions(entryId)).toEqual([])
})

test('bots are told it worked, nothing is stored', async () => {
  const {entryId, store, submit} = await setup()
  const result = await submit({
    name: 'Bot',
    email: 'bot@example.com',
    _alinea_website: 'https://spam.example'
  })
  expect(result.body).toEqual({ok: true})
  expect(await store.listSubmissions(entryId)).toEqual([])
})

test('only the server of the site can submit', async () => {
  const {submit} = await setup()
  const result = await submit({name: 'Ann'}, 'wrong')
  expect(result.status).toBe(401)
})
