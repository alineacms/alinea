import {Entry} from '#/core/Entry.js'
import {createRecord, recordJson} from '#/core/EntryRecord.js'
import type {PreviewDelta} from '#/core/Preview.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'
import {applyPreview, resolvePreview} from './ParsePreview.js'

const test = suite(import.meta)

const Page = Config.document('Page', {fields: {body: Field.text('Body')}})
const config = Config.create({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})

async function setup() {
  const db = new LocalDB(config)
  await db.create({type: Page, id: 'home', set: {title: 'Home', body: 'Hi'}})
  const entry = await db.get({id: 'home', select: Entry})
  return {db, entry}
}

async function delta(
  entry: Entry,
  data: Record<string, unknown>
): Promise<PreviewDelta> {
  const draft = createRecord(
    {...entry, data: {...entry.data, ...data}},
    'published'
  )
  return {
    version: 2,
    locale: null,
    entryId: entry.id,
    contentHash: 'any',
    status: 'published',
    fileHash: entry.fileHash,
    delta: await createFilePatch(recordJson(entry), JSON.stringify(draft))
  }
}

test('a record delta applies to the row it was made from', async () => {
  const {db, entry} = await setup()
  const preview = await applyPreview(db, await delta(entry, {body: 'Hello'}))
  test.ok(preview && 'entry' in preview)
  if (!preview || !('entry' in preview)) return
  test.is(preview.entry.data.body, 'Hello')
  test.is(preview.entry.data.title, 'Home')
})

test('a delta from another version takes the whole record', async () => {
  const {db, entry} = await setup()
  const preview = await delta(entry, {body: 'Hello'})
  const stale = {...preview, fileHash: 'other'}
  test.is(await applyPreview(db, stale), undefined)
  const record = createRecord(
    {...entry, data: {...entry.data, body: 'Whole'}},
    'published'
  )
  const applied = await applyPreview(db, {...stale, record})
  test.ok(applied && 'entry' in applied && applied.entry.data.body === 'Whole')
})

test('a delta that applies needs no sync', async () => {
  const {db, entry} = await setup()
  let synced = 0
  const sync = async () => synced++
  const preview = await resolvePreview(
    db,
    await delta(entry, {body: 'Hello'}),
    sync
  )
  test.ok(preview && 'entry' in preview)
  test.is(synced, 0)
  await resolvePreview(
    db,
    {...(await delta(entry, {body: 'Hello'})), fileHash: 'other'},
    sync
  )
  test.is(synced, 1)
})

test('a file patch from before still applies', async () => {
  const {db, entry} = await setup()
  const base = JSON.stringify(createRecord(entry, 'published'), null, '  ')
  const next = JSON.stringify(
    createRecord({...entry, data: {...entry.data, body: 'Old'}}, 'published'),
    null,
    '  '
  )
  const preview = await applyPreview(db, {
    locale: null,
    entryId: 'home',
    contentHash: await db.sha,
    status: 'published',
    patch: await createFilePatch(base, next)
  })
  test.ok(preview && 'entry' in preview && preview.entry.data.body === 'Old')
})
