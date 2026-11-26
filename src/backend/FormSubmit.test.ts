import {SubmissionStore} from '#/backend/api/SubmissionStore.js'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import {MissingCredentialsError} from '#/backend/Auth.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import type {AuthedContext, RequestContext} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {Field as CoreField} from '#/core/Field.js'
import {Type} from '#/core/Type.js'
import type {FormMail, FormsOptions} from '#/core/Forms.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field, Form} from '#/index.js'
import {role} from '#/core/Role.js'
import {Database as BunSqlite} from 'bun:sqlite'
import {expect, test} from 'bun:test'
import * as driver from 'rado/driver'

const Contact = Config.document('Contact', {
  fields: {inputs: Field.form('Inputs', {inputs: Form.defaults})}
})

const ServiceForm = Form.type('Request', {inputs: Form.defaults})

// Fields named like the settings of a form that are not its settings
const Named = Config.document('Named', {
  fields: {
    inputs: Field.form('Inputs', {inputs: Form.defaults}),
    keep: Field.text('Keep'),
    limit: Field.number('Limit')
  }
})

const Kept = Config.document('Kept', {
  fields: {
    inputs: Field.form('Inputs', {inputs: Form.defaults}),
    retention: Form.keep(),
    ...Form.limits()
  }
})

const Page = Config.document('Page', {fields: {}})

const main = Config.workspace('Main', {
  source: 'content',
  roots: {forms: Config.root('Forms')}
})

const translated = Config.workspace('Main', {
  source: 'content',
  roots: {forms: Config.root('Forms', {i18n: {locales: ['en', 'nl', 'nl-BE']}})}
})

const rows = [
  {_id: 'name', _index: 'a0', _type: 'text', label: 'Name', required: true},
  {_id: 'mail', _index: 'a1', _type: 'email', label: 'Email', required: true}
]

interface SetupOptions {
  form?: Type
  set?: Record<string, unknown>
  forms?: FormsOptions
  /** Places the form in a root with languages, in this one */
  locale?: string
  dev?: boolean
}

async function setup({
  form = Contact,
  set = {title: 'Contact', inputs: rows},
  forms,
  locale,
  dev = false
}: SetupOptions = {}) {
  const cms = createCMS({
    schema: {Contact, ServiceForm, Named, Kept, Page},
    workspaces: {main: locale ? translated : main}
  })
  const db = new LocalDB(cms.config)
  await db.create({type: form, locale, set: set as never})
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
          authorization: `Bearer ${key}`,
          'x-alinea-dev-key': key
        },
        body: JSON.stringify({
          entryId,
          locale,
          visitor,
          data: Object.entries(data)
        })
      }),
      {...context, isDev: dev}
    )
    return {status: response.status, body: await response.json()}
  }
  return {entryId, db, store, submit, handle}
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
    errors: {name: 'Fill in this field', email: 'Use a valid email address'},
    codes: {name: 'required', email: 'invalidEmail'}
  })
  expect(
    await store.listSubmissions(entryId).then(page => page.submissions)
  ).toEqual([])
})

test('errors are in the language of the form', async () => {
  const {submit} = await setup({locale: 'nl-BE'})
  expect((await submit({email: 'ann'})).body).toEqual({
    ok: false,
    errors: {name: 'Vul dit veld in', email: 'Gebruik een geldig e-mailadres'},
    codes: {name: 'required', email: 'invalidEmail'}
  })
})

test('forms.messages replaces the texts of a locale', async () => {
  const {submit} = await setup({
    locale: 'nl-BE',
    forms: {messages: {'nl-BE': {required: 'Graag invullen'}}}
  })
  expect((await submit({email: 'ann'})).body.errors).toEqual({
    name: 'Graag invullen',
    email: 'Gebruik een geldig e-mailadres'
  })
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

test('bots see the message of the form like people do', async () => {
  const {submit} = await setup({
    form: ServiceForm,
    set: {title: 'Request', inputs: rows, after: 'message', message: 'Thanks!'}
  })
  const result = await submit({
    name: 'Bot',
    email: 'bot@example.com',
    _alinea_website: 'https://spam.example'
  })
  expect(result.body).toEqual({ok: true, confirmation: 'Thanks!'})
})

test('in development answers taken for spam tell why', async () => {
  const {entryId, store, submit} = await setup({dev: true})
  const result = await submit({
    name: 'Ann',
    email: 'ann@example.com',
    _alinea_website: 'autofilled'
  })
  expect(result.body).toEqual({
    ok: false,
    message: 'Taken for spam: the hidden _alinea_website input was filled in'
  })
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
  expect(sent).toMatchObject([
    {
      to: ['desk@example.com'],
      subject: 'Request from Ann',
      text: 'Write back to ann@example.com',
      content: '<p style="margin:0 0 16px">Write back to ann@example.com</p>'
    }
  ])
  expect(sent[0].html).toContain(sent[0].content)
  // A mail that failed is left out, the answers are stored anyway
  const [stored] = await store
    .listSubmissions(entryId)
    .then(page => page.submissions)
  expect(stored.notified).toEqual(['Helpdesk'])
})

test('a visitor the site names is limited, and so is the form', async () => {
  const {submit} = await setup({
    forms: {rateLimit: {submissions: 4, perVisitor: {submissions: 2}}}
  })
  const answers = {name: 'Ann', email: 'ann@example.com'}
  expect((await submit(answers, 'test', 'session-a')).body).toEqual({ok: true})
  expect((await submit(answers, 'test', 'session-a')).body).toEqual({ok: true})
  expect((await submit(answers, 'test', 'session-a')).body).toEqual({
    ok: false,
    message: 'You sent this form too often, try again later'
  })
  // Another visitor may still send it, until the form took its share
  expect((await submit(answers, 'test', 'session-b')).body).toEqual({ok: true})
  expect((await submit(answers)).body).toEqual({ok: true})
  expect((await submit(answers)).body).toEqual({
    ok: false,
    message: 'This form takes no more answers right now, try again later'
  })
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

async function status(
  handle: Awaited<ReturnType<typeof setup>>['handle'],
  entryId: string
) {
  const response = await handle(
    new Request(`http://localhost/api?action=formStatus&entryId=${entryId}`, {
      headers: {accept: 'application/json', authorization: 'Bearer test'}
    }),
    context
  )
  return response.json()
}

test('a form closes once it took its most submissions', async () => {
  const {entryId, submit, handle} = await setup({
    form: ServiceForm,
    set: {title: 'Waiting list', inputs: rows, limit: 1, full: 'It is full'}
  })
  expect(await status(handle, entryId)).toEqual({open: true})
  const first = await submit({name: 'Ann', email: 'ann@example.com'})
  expect(first.body.ok).toBe(true)
  expect(await status(handle, entryId)).toEqual({
    open: false,
    message: 'It is full'
  })
  const second = await submit({name: 'Bob', email: 'bob@example.com'})
  expect(second.body).toEqual({ok: false, message: 'It is full'})
})

test('a unique input takes each answer once', async () => {
  const unique = [rows[0], {...rows[1], unique: true}]
  const {submit} = await setup({set: {title: 'Contact', inputs: unique}})
  expect((await submit({name: 'Ann', email: 'ann@example.com'})).body.ok).toBe(
    true
  )
  expect(
    (await submit({name: 'Ann', email: ' ANN@example.com '})).body
  ).toEqual({
    ok: false,
    errors: {email: 'This answer was already sent'},
    codes: {email: 'alreadySent'}
  })
  expect(
    (await submit({name: 'Ann', email: 'other@example.com'})).body.ok
  ).toBe(true)
})

test('a unique answer is compared as it is, wildcards and all', async () => {
  const unique = [rows[0], {...rows[1], unique: true}]
  const {submit} = await setup({set: {title: 'Contact', inputs: unique}})
  const send = (email: string) => submit({name: 'Ann', email})
  expect((await send('john_doe@x.com')).body.ok).toBe(true)
  expect((await send('johnxdoe@x.com')).body.ok).toBe(true)
  expect((await send('john_doe@x.com')).body.codes).toEqual({
    email: 'alreadySent'
  })
})

test('answers sent at the same time pass the checks one at a time', async () => {
  const unique = [rows[0], {...rows[1], unique: true}]
  const once = await setup({set: {title: 'Contact', inputs: unique}})
  const ann = {name: 'Ann', email: 'ann@example.com'}
  const both = await Promise.all([once.submit(ann), once.submit(ann)])
  expect(both.map(result => result.body.ok).sort()).toEqual([false, true])
  const full = await setup({
    form: ServiceForm,
    set: {title: 'Waiting list', inputs: rows, limit: 1}
  })
  await Promise.all([full.submit(ann), full.submit(ann), full.submit(ann)])
  expect((await full.store.listSubmissions(full.entryId)).total).toBe(1)
})

test('settings are read from the fields of Form.keep and Form.limits', async () => {
  const later = Date.now() / 1000 + 31 * 24 * 60 * 60
  const ann = {name: 'Ann', email: 'ann@example.com'}
  const named = await setup({
    form: Named,
    set: {title: 'Named', inputs: rows, keep: '30', limit: 1}
  })
  expect((await named.submit(ann)).body.ok).toBe(true)
  expect((await named.submit(ann)).body.ok).toBe(true)
  await named.store.purgeSubmissions(later)
  expect((await named.store.listSubmissions(named.entryId)).total).toBe(2)
  const kept = await setup({
    form: Kept,
    set: {title: 'Kept', inputs: rows, retention: '30', limit: 1}
  })
  expect((await kept.submit(ann)).body.ok).toBe(true)
  expect((await kept.submit(ann)).body.ok).toBe(false)
  await kept.store.purgeSubmissions(later)
  expect((await kept.store.listSubmissions(kept.entryId)).total).toBe(0)
})

test('a form goes to the page in its own language', async () => {
  const {db, submit} = await setup({
    form: ServiceForm,
    locale: 'nl',
    set: {title: 'Aanvraag', inputs: rows, after: 'page'}
  })
  for (const locale of ['en', 'nl'])
    await db.create({
      type: Page,
      id: 'thanks',
      locale,
      set: {title: 'Thanks', path: `thanks-${locale}`}
    })
  const formId = (await db.first({select: Entry.id, type: ServiceForm}))!
  await db.update({
    id: formId,
    locale: 'nl',
    set: {page: {_id: 'link', _type: 'entry', _entry: 'thanks'}} as never
  })
  const result = await submit({name: 'Ann', email: 'ann@example.com'})
  expect(result.body).toEqual({ok: true, redirect: '/nl/thanks-nl'})
})

test('editors change submissions with json only', async () => {
  const {entryId, store, submit, handle} = await setup()
  await submit({name: 'Ann', email: 'ann@example.com'})
  const [{id}] = (await store.listSubmissions(entryId)).submissions
  const response = await handle(
    new Request(
      `http://localhost/api?action=submissions&entryId=${entryId}&id=${id}`,
      {
        method: 'POST',
        headers: {'content-type': 'text/plain', authorization: 'Bearer test'},
        body: JSON.stringify({status: 'archived'})
      }
    ),
    context
  )
  expect(response.status).toBe(400)
})

test('submissions are listed by the language they were sent in', async () => {
  const {entryId, store, submit} = await setup()
  await submit({name: 'Ann', email: 'ann@example.com'})
  expect((await store.listSubmissions(entryId, {locale: 'en'})).total).toBe(0)
  expect((await store.listSubmissions(entryId)).total).toBe(1)
})

test('keep and most submissions are the same in every language', () => {
  for (const key of ['keep', 'limit'])
    expect(CoreField.options(Type.field(ServiceForm, key)!).shared).toBe(true)
})

test('rules on the language follow the language of the form', async () => {
  const sent = Array<string>()
  const dutch = {
    match: 'all',
    rules: [{id: 'r', input: '@locale', op: 'is', value: ['nl']}]
  }
  const setupIn = (locale: string) =>
    setup({
      form: ServiceForm,
      locale,
      set: {
        title: 'Request',
        inputs: [
          ...rows,
          {
            _id: 'vat',
            _index: 'a2',
            _type: 'text',
            label: 'VAT',
            required: true,
            showWhen: dutch
          }
        ],
        mails: [
          {
            _id: 'nl',
            _index: 'a0',
            _type: 'mail',
            name: 'Dutch desk',
            to: 'address',
            address: 'nl@example.com',
            sendWhen: dutch,
            subject: 'Nieuw',
            body: ''
          }
        ]
      },
      forms: {mailer: mail => void sent.push(mail.to[0])}
    })
  const answers = {name: 'Ann', email: 'ann@example.com'}
  const nl = await setupIn('nl')
  expect((await nl.submit(answers)).body.errors).toEqual({
    vat: 'Vul dit veld in'
  })
  expect((await nl.submit({...answers, vat: 'BE1'})).body.ok).toBe(true)
  const en = await setupIn('en')
  expect((await en.submit(answers)).body.ok).toBe(true)
  expect(sent).toEqual(['nl@example.com'])
})

test('a mail links to the submission and attaches its files', async () => {
  const sent: Array<FormMail> = []
  const kept = new Map<string, Uint8Array>()
  const file = (id: string, index: string, label: string) => ({
    _id: id,
    _index: index,
    _type: 'file',
    label,
    accept: '.png'
  })
  const mail = {
    _index: 'a0',
    _type: 'mail',
    to: 'address',
    address: 'desk@example.com',
    subject: 'Request',
    body: [
      {
        _type: 'paragraph',
        content: [{_type: 'text', text: '{{all answers}} {{submission link}}'}]
      }
    ]
  }
  const {entryId, store, submit, handle} = await setup({
    form: ServiceForm,
    set: {
      title: 'Request',
      inputs: [...rows, file('a', 'a2', 'Shot'), file('b', 'a3', 'Other')],
      mails: [
        {...mail, _id: 'desk', name: 'Desk', attach: true},
        {...mail, _id: 'plain', name: 'Plain'}
      ]
    },
    forms: {
      mailer: mail => void sent.push(mail),
      files: {
        async write(key, content) {
          kept.set(key, content)
        },
        async read(key) {
          return kept.get(key)
        },
        async remove() {}
      }
    }
  })
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  async function upload(input: string, name: string) {
    const prepared = await handle(
      new Request('http://localhost/api?action=formUpload', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: 'Bearer test'
        },
        body: JSON.stringify({
          entryId,
          input,
          name,
          size: png.length,
          type: 'image/png'
        })
      }),
      context
    )
    const ticket = await prepared.json()
    await handle(new Request(ticket.url, {method: 'PUT', body: png}), context)
    return ticket.token as string
  }
  const shot = await upload('shot', 'shot.png')
  const other = await upload('other', 'other.png')
  // A file that can not be read is left out, the mail is still sent
  const lost = [...kept.keys()][1]
  kept.delete(lost)
  const result = await submit({
    name: 'Ann',
    email: 'ann@example.com',
    shot,
    other
  })
  expect(result.body.ok).toBe(true)
  const [desk, plain] = sent
  const [{id}] = (await store.listSubmissions(entryId)).submissions
  const link = `http://localhost/admin#/edit?id=${entryId}&submission=${id}`
  expect(desk.text).toBe(
    'Name: Ann\nEmail: ann@example.com\nShot: shot.png\nOther: other.png ' +
      link
  )
  expect(desk.content).toContain(`<a href="${link.replace('&', '&amp;')}"`)
  expect(desk.content).not.toContain('<a href="http://localhost/api')
  expect(desk.attachments).toEqual([
    {
      filename: 'shot.png',
      content: btoa(String.fromCharCode(...png)),
      encoding: 'base64',
      contentType: 'image/png'
    }
  ])
  expect(plain.attachments).toBeUndefined()
})

test('an editor of one language reads the submissions sent in it', async () => {
  const cms = createCMS({
    schema: {Contact},
    workspaces: {main: translated},
    roles: {
      dutch: role('Dutch', {
        permissions(policy) {
          policy.set({locale: 'nl', allow: {read: true, update: true}})
        }
      })
    }
  })
  const db = new LocalDB(cms.config)
  for (const locale of ['en', 'nl'])
    await db.create({
      type: Contact,
      id: 'contact',
      locale,
      set: {title: 'Contact', inputs: rows}
    })
  const store = new SubmissionStore({
    db: driver['bun:sqlite'](new BunSqlite(':memory:'))
  })
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(db, store, {
        async verify(): Promise<AuthedContext> {
          return {...context, token: 'test', user: {roles: ['dutch'], sub: 'a'}}
        }
      })
    }
  })
  const json = {accept: 'application/json', 'content-type': 'application/json'}
  for (const locale of ['en', 'nl'])
    await handle(
      new Request('http://localhost/api?action=submit', {
        method: 'POST',
        headers: {...json, authorization: 'Bearer test'},
        body: JSON.stringify({
          entryId: 'contact',
          locale,
          data: [
            ['name', locale],
            ['email', 'ann@example.com']
          ]
        })
      }),
      context
    )
  const list = async (query: object) => {
    const params = new URLSearchParams({
      action: 'submissions',
      entryId: 'contact',
      query: JSON.stringify(query)
    })
    const response = await handle(
      new Request(`http://localhost/api?${params}`, {headers: json}),
      context
    )
    return response.ok ? (await response.json()).submissions : response.status
  }
  const [dutch] = await list({})
  expect(dutch.locale).toBe('nl')
  expect(await list({locale: 'en'})).toBe(401)
  const [english] = (await store.listSubmissions('contact', {locale: 'en'}))
    .submissions
  const archive = (id: string) =>
    handle(
      new Request(
        `http://localhost/api?action=submissions&entryId=contact&id=${id}`,
        {method: 'POST', headers: json, body: '{"status":"archived"}'}
      ),
      context
    )
  expect((await archive(english.id)).status).toBe(401)
  expect((await archive(dutch.id)).status).toBe(204)
})
