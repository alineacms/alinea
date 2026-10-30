import {SubmissionStore} from '#/backend/api/SubmissionStore.js'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import {MissingCredentialsError} from '#/backend/Auth.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import type {
  AuthedContext,
  FormFileRef,
  PrepareUploadResult,
  RequestContext
} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {FormsOptions} from '#/core/Forms.js'
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
  {_id: 'name', _index: 'a0', _type: 'text', label: 'Name'},
  {
    _id: 'shot',
    _index: 'a1',
    _type: 'file',
    label: 'Screenshot',
    required: true,
    accept: '.png',
    maxSize: 1
  }
]

const context: RequestContext = {
  apiKey: 'test',
  handlerUrl: new URL('http://localhost/api'),
  isDev: false
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])

async function setup(forms?: FormsOptions) {
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
    forms,
    remote() {
      return composeBackend(db, store, {
        async verify(): Promise<AuthedContext> {
          throw new MissingCredentialsError('Missing user credentials')
        }
      })
    }
  })
  const json = {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: 'Bearer test'
  }
  async function prepare(name: string, size: number) {
    const response = await handle(
      new Request('http://localhost/api?action=formUpload', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({entryId, input: 'screenshot', name, size})
      }),
      context
    )
    return (await response.json()) as PrepareUploadResult
  }
  // The browser of the visitor sends the file, without the api key
  async function upload(url: string, content: Uint8Array<ArrayBuffer>) {
    const response = await handle(
      new Request(url, {method: 'PUT', body: content}),
      context
    )
    return {status: response.status, text: await response.text()}
  }
  async function submit(data: Array<[string, string]>) {
    const response = await handle(
      new Request('http://localhost/api?action=submit', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({entryId, data})
      }),
      context
    )
    return response.json()
  }
  return {entryId, store, prepare, upload, submit}
}

test('an uploaded file is stored with the submission', async () => {
  const {entryId, store, prepare, upload, submit} = await setup()
  const ticket = await prepare('error.png', png.length)
  if (!ticket.ok) throw new Error(ticket.message)
  expect(await upload(ticket.url, png)).toEqual({status: 204, text: ''})
  const result = await submit([
    ['name', 'Ann'],
    ['screenshot', ticket.token]
  ])
  expect(result).toEqual({ok: true})
  const [stored] = await store
    .listSubmissions(entryId)
    .then(page => page.submissions)
  const [file] = stored.values.screenshot as Array<FormFileRef>
  expect(file).toEqual({
    id: file.id,
    name: 'error.png',
    size: png.length,
    type: ''
  })
  const saved = await store.readFormFile(entryId, file.id)
  expect(saved?.submissionId).toBe(stored.id)
  expect(Array.from(saved!.content!)).toEqual(Array.from(png))
  // A ticket is used once
  expect(
    await submit([
      ['name', 'Bo'],
      ['screenshot', ticket.token]
    ])
  ).toEqual({ok: false, errors: {screenshot: 'Upload the file again'}})
})

test('files are checked before and while they are uploaded', async () => {
  const {prepare, upload, submit} = await setup()
  expect(await prepare('invoice.pdf', 10)).toEqual({
    ok: false,
    message: 'Choose a file of type .png'
  })
  expect(await prepare('huge.png', 2 * 1024 * 1024)).toEqual({
    ok: false,
    message: 'Choose a file of at most 1 MB'
  })
  const script = new TextEncoder().encode('#!/bin/sh\n')
  const ticket = await prepare('error.png', script.length)
  if (!ticket.ok) throw new Error(ticket.message)
  expect(await upload(ticket.url, script)).toEqual({
    status: 415,
    text: 'error.png is not the kind of file its name says'
  })
  expect(await upload(`${ticket.url}x`, png)).toEqual({
    status: 401,
    text: 'Upload the file again'
  })
  expect(await submit([['name', 'Ann']])).toEqual({
    ok: false,
    errors: {screenshot: 'Add a file'}
  })
})

test('files that were never submitted or whose submission went are removed', async () => {
  const {entryId, store, prepare, upload, submit} = await setup()
  const now = Math.floor(Date.now() / 1000)
  const file = (id: string, createdAt: number) => ({
    id,
    entryId,
    input: 'screenshot',
    name: `${id}.png`,
    size: png.length,
    type: 'image/png',
    submissionId: null,
    content: png,
    visitor: null,
    createdAt
  })
  await store.storeFormFile(file('old', now - 2 * 24 * 60 * 60))
  await store.storeFormFile(file('recent', now))
  await store.purgeSubmissions(now)
  expect(await store.readFormFile(entryId, 'old')).toBeUndefined()
  expect(await store.readFormFile(entryId, 'recent')).toBeDefined()
  const ticket = await prepare('error.png', png.length)
  if (!ticket.ok) throw new Error(ticket.message)
  await upload(ticket.url, png)
  await submit([['screenshot', ticket.token]])
  const [submission] = await store
    .listSubmissions(entryId)
    .then(page => page.submissions)
  const [sent] = submission.values.screenshot as Array<FormFileRef>
  await store.deleteSubmission(entryId, submission.id)
  expect(await store.readFormFile(entryId, sent.id)).toBeUndefined()
})

test('files go to forms.files when it is set', async () => {
  const kept = new Map<string, Uint8Array>()
  const {entryId, store, prepare, upload, submit} = await setup({
    files: {
      async write(key, content) {
        kept.set(key, content)
      },
      async read(key) {
        return kept.get(key)
      },
      async remove(keys) {
        for (const key of keys) kept.delete(key)
      }
    }
  })
  const ticket = await prepare('error.png', png.length)
  if (!ticket.ok) throw new Error(ticket.message)
  await upload(ticket.url, png)
  await submit([['screenshot', ticket.token]])
  const [submission] = (await store.listSubmissions(entryId)).submissions
  const [sent] = submission.values.screenshot as Array<FormFileRef>
  expect((await store.readFormFile(entryId, sent.id))?.content).toBeNull()
  expect(Array.from(kept.get(`${entryId}/${sent.id}`)!)).toEqual(
    Array.from(png)
  )
})
