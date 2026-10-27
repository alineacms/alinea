import type {StoredSubmission} from '#/core/Connection.js'
import {Database as BunSqlite} from 'bun:sqlite'
import {expect, test} from 'bun:test'
import * as driver from 'rado/driver'
import {SubmissionStore} from './SubmissionStore.js'

function createStore() {
  return new SubmissionStore({
    db: driver['bun:sqlite'](new BunSqlite(':memory:'))
  })
}

function submission(
  id: string,
  createdAt: number,
  extra: Partial<StoredSubmission> = {}
): StoredSubmission {
  return {
    id,
    entryId: 'form',
    locale: null,
    field: 'inputs',
    values: {name: id},
    definition: [{id: 'name', label: 'Name'}],
    createdAt,
    status: 'new',
    notified: null,
    page: null,
    search: id.toLowerCase(),
    choices: '',
    visitor: null,
    expiresAt: null,
    ...extra
  }
}

test('submissions are listed a page at a time, the latest first', async () => {
  const store = createStore()
  for (let index = 0; index < 5; index++)
    await store.storeSubmission(submission(`s${index}`, index))
  const first = await store.listSubmissions('form', {limit: 2})
  expect(first.total).toBe(5)
  expect(first.submissions.map(s => s.id)).toEqual(['s4', 's3'])
  const last = await store.listSubmissions('form', {limit: 2, offset: 4})
  expect(last.submissions.map(s => s.id)).toEqual(['s0'])
  // The form they were sent with is stored once and comes with each
  expect(last.submissions[0].definition).toEqual([{id: 'name', label: 'Name'}])
})

test('submissions are found by status, time, choice and text', async () => {
  const store = createStore()
  await store.storeSubmission(
    submission('Ann', 100, {search: 'ann\nrepair', choices: '|service=repair|'})
  )
  await store.storeSubmission(
    submission('Bo', 200, {status: 'archived', choices: '|service=install|'})
  )
  const ids = async (query: object) =>
    (await store.listSubmissions('form', query)).submissions.map(s => s.id)
  expect(await ids({status: 'open'})).toEqual(['Ann'])
  expect(await ids({status: 'archived'})).toEqual(['Bo'])
  expect(await ids({from: 150})).toEqual(['Bo'])
  expect(await ids({until: 150})).toEqual(['Ann'])
  expect(await ids({choice: {key: 'service', value: 'install'}})).toEqual([
    'Bo'
  ])
  expect(await ids({search: 'REPAIR'})).toEqual(['Ann'])
  expect(await ids({search: '%'})).toEqual(['Bo', 'Ann'])
})

test('expired submissions and their files are purged', async () => {
  const store = createStore()
  await store.storeSubmission(submission('old', 1, {expiresAt: 10}))
  await store.storeSubmission(submission('kept', 2))
  await store.storeFormFile({
    id: 'file',
    entryId: 'form',
    submissionId: 'old',
    input: 'cv',
    name: 'cv.pdf',
    type: 'application/pdf',
    size: 1,
    content: null,
    visitor: null,
    createdAt: 1
  })
  expect(await store.purgeSubmissions(20)).toEqual([
    {entryId: 'form', id: 'file'}
  ])
  const {submissions} = await store.listSubmissions('form')
  expect(submissions.map(s => s.id)).toEqual(['kept'])
})

test('all submissions of a form are deleted with it', async () => {
  const store = createStore()
  await store.storeSubmission(submission('one', 1))
  await store.storeSubmission(submission('two', 2, {entryId: 'other'}))
  await store.deleteSubmission('form')
  expect((await store.listSubmissions('form')).total).toBe(0)
  expect((await store.listSubmissions('other')).total).toBe(1)
})

test('what a visitor sent within a time is counted', async () => {
  const store = createStore()
  await store.storeSubmission(submission('a', 100, {visitor: 'v'}))
  await store.storeSubmission(submission('b', 200, {visitor: 'v'}))
  await store.storeSubmission(submission('c', 200, {visitor: 'w'}))
  expect(await store.visitorActivity('form', 'v', 150)).toEqual({
    submissions: 1,
    files: 0
  })
})
