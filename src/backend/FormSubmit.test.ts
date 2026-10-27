import {SubmissionStore} from '#/backend/api/SubmissionStore.js'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import {MissingCredentialsError} from '#/backend/Auth.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import type {AuthedContext, RequestContext} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {FormMail, FormsOptions} from '#/core/Forms.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field, Form} from '#/index.js'
import {Database as BunSqlite} from 'bun:sqlite'
import {expect, test} from 'bun:test'
import * as driver from 'rado/driver'

const Contact = Config.document('Contact', {
  fields: {inputs: Field.form('Inputs', {inputs: Form.defaults})}
})

const ServiceForm = Form.type('Request', {inputs: Form.defaults})

const main = Config.workspace('Main', {
  source: 'content',
  roots: {forms: Config.root('Forms')}
})

const rows = [
  {_id: 'name', _index: 'a0', _type: 'text', label: 'Name', required: true},
  {_id: 'mail', _index: 'a1', _type: 'email', label: 'Email', required: true}
]

interface SetupOptions {
  form?: typeof Contact | typeof ServiceForm
  set?: Record<string, unknown>
  forms?: FormsOptions
}

async function setup({
  form = Contact,
  set = {title: 'Contact', inputs: rows},
  forms
}: SetupOptions = {}) {
  const cms = createCMS({schema: {Contact, ServiceForm}, workspaces: {main}})
  const db = new LocalDB(cms.config)
  await db.create({type: form, set: set as never})
  const entryId = (await db.first({select: Entry.id, type: form}))!
  const store = new SubmissionStore({
    db: driver['bun:sqlite'](new BunSqlite(':memory:'))
  })
  const handle = createHandler({
    cms,
    db,
    forms,
    remote() {
      return composeBackend(db, store, {
        async verify(): Promise<AuthedContext> {
          throw new MissingCredentialsError('Missing user credentials')
        }
      })
    }
  })
  async function submit(
    data: Record<string, string>,
    key = 'test',
    visitor?: string
  ) {
    const response = await handle(
      new Request('http://localhost/api?action=submit', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${key}`
        },
        body: JSON.stringify({entryId, visitor, data: Object.entries(data)})
      }),
      context
    )
    return {status: response.status, body: await response.json()}
  }
  return {entryId, store, submit, handle}
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
  const [stored] = await store
    .listSubmissions(entryId)
    .then(page => page.submissions)
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
  expect(
    await store.listSubmissions(entryId).then(page => page.submissions)
  ).toEqual([])
})

test('bots are told it worked, nothing is stored', async () => {
  const {entryId, store, submit} = await setup()
  const result = await submit({
    name: 'Bot',
    email: 'bot@example.com',
    _alinea_website: 'https://spam.example'
  })
  expect(result.body).toEqual({ok: true})
  expect(
    await store.listSubmissions(entryId).then(page => page.submissions)
  ).toEqual([])
})

test('only the server of the site can submit', async () => {
  const {submit} = await setup()
  const result = await submit({name: 'Ann'}, 'wrong')
  expect(result.status).toBe(401)
})

test('editors mark, archive and delete submissions of a form', async () => {
  const {entryId, store, submit} = await setup()
  await submit({name: 'Ann', email: 'ann@example.com'})
  const [{id}] = await store
    .listSubmissions(entryId)
    .then(page => page.submissions)
  // Another form's id does not reach it
  await store.updateSubmission('other', id, 'archived')
  await store.updateSubmission(entryId, id, 'read')
  expect(
    (await store.listSubmissions(entryId).then(page => page.submissions)).map(
      s => s.status
    )
  ).toEqual(['read'])
  await store.deleteSubmission('other', id)
  await store.deleteSubmission(entryId, id)
  expect(
    await store.listSubmissions(entryId).then(page => page.submissions)
  ).toEqual([])
})

test('the server of the site can not read submissions', async () => {
  const {entryId, handle} = await setup()
  const response = await handle(
    new Request(`http://localhost/api?action=submissions&entryId=${entryId}`, {
      headers: {accept: 'application/json', authorization: 'Bearer test'}
    }),
    context
  )
  expect(response.status).toBe(401)
})

test('mails go out through the mailer and are noted on the submission', async () => {
  const sent: Array<FormMail> = []
  const {entryId, store, submit} = await setup({
    form: ServiceForm,
    set: {
      title: 'Request',
      path: 'request',
      inputs: rows,
      after: 'message',
      message: 'Thanks!',
      mails: [
        {
          _id: 'desk',
          _index: 'a0',
          _type: 'mail',
          name: 'Helpdesk',
          to: 'address',
          address: 'desk@example.com',
          subject: 'Request from {{name}}',
          body: 'Write back to {{email}}'
        },
        {
          _id: 'fails',
          _index: 'a1',
          _type: 'mail',
          name: 'Fails',
          to: 'address',
          address: 'fail@example.com',
          subject: 'Fails',
          body: ''
        }
      ]
    },
    forms: {
      mailer(mail) {
        if (mail.to.includes('fail@example.com')) throw new Error('Bounced')
        sent.push(mail)
      }
    }
  })
  const result = await submit({name: 'Ann', email: 'ann@example.com'})
  expect(result.body).toEqual({ok: true, confirmation: 'Thanks!'})
  expect(sent).toEqual([
    {
      to: ['desk@example.com'],
      subject: 'Request from Ann',
      text: 'Write back to ann@example.com'
    }
  ])
  // A mail that failed is left out, the answers are stored anyway
  const [stored] = await store
    .listSubmissions(entryId)
    .then(page => page.submissions)
  expect(stored.notified).toEqual(['Helpdesk'])
})

test('a visitor who sends a form often is asked to wait', async () => {
  const {submit} = await setup({forms: {limits: {submissions: 2}}})
  const answers = {name: 'Ann', email: 'ann@example.com'}
  expect((await submit(answers, 'test', '1.2.3.4')).body).toEqual({ok: true})
  expect((await submit(answers, 'test', '1.2.3.4')).body).toEqual({ok: true})
  expect((await submit(answers, 'test', '1.2.3.4')).body).toEqual({
    ok: false,
    message: 'You sent this form often, try again later'
  })
  // Another visitor may still send it
  expect((await submit(answers, 'test', '5.6.7.8')).body).toEqual({ok: true})
})

test('the page is kept without its query, onSubmit hears of it', async () => {
  const heard = Array<string>()
  const {entryId, store, submit} = await setup({
    forms: {
      onSubmit({submission, title}) {
        heard.push(`Received ${submission.values.name} for ${title}`)
      }
    }
  })
  await submit({
    name: 'Ann',
    email: 'ann@example.com',
    _alinea_page: 'https://example.com/contact?email=ann@example.com'
  })
  const [stored] = (await store.listSubmissions(entryId)).submissions
  expect(stored.page).toBe('https://example.com/contact')
  expect(heard).toEqual(['Received Ann for Contact'])
})

test('submissions of a form with a retention expire', async () => {
  const {entryId, store, submit} = await setup({
    form: ServiceForm,
    set: {title: 'Request', inputs: rows, keep: '30'}
  })
  await submit({name: 'Ann', email: 'ann@example.com'})
  expect((await store.listSubmissions(entryId)).total).toBe(1)
  await store.purgeSubmissions(Date.now() / 1000 + 31 * 24 * 60 * 60)
  expect((await store.listSubmissions(entryId)).total).toBe(0)
})
test('removing a form entry removes its submissions, a draft does not', async () => {
  const cms = createCMS({schema: {Contact, ServiceForm}, workspaces: {main}})
  const db = new LocalDB(cms.config)
  await db.create({type: Contact, set: {title: 'Contact', inputs: rows}})
  const entryId = (await db.first({select: Entry.id, type: Contact}))!
  const store = new SubmissionStore({
    db: driver['bun:sqlite'](new BunSqlite(':memory:'))
  })
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(db, store, {
        async verify(): Promise<AuthedContext> {
          return {...context, token: 'test', user: {roles: ['admin'], sub: 'a'}}
        }
      })
    }
  })
  const mutate = (mutations: Array<unknown>) =>
    handle(
      new Request('http://localhost/api?action=mutate', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify(mutations)
      }),
      context
    )
  await handle(
    new Request('http://localhost/api?action=submit', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: 'Bearer test'
      },
      body: JSON.stringify({
        entryId,
        data: [
          ['name', 'Ann'],
          ['email', 'ann@example.com']
        ]
      })
    }),
    context
  )
  await mutate([{op: 'remove', id: entryId, status: 'draft'}])
  expect((await store.listSubmissions(entryId)).total).toBe(1)
  await mutate([{op: 'remove', id: entryId}])
  expect(await db.first({id: entryId, status: 'all'})).toBeNull()
  expect((await store.listSubmissions(entryId)).total).toBe(0)
})
