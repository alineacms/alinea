import {suite} from '@alinea/suite'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {Entry} from 'alinea/core/Entry'
import {FSSource} from 'alinea/core/source/FSSource'
import {exportSource, importSource} from 'alinea/core/source/SourceExport'
import {fileURLToPath} from 'node:url'
import {cms} from './cms.js'

const test = suite(import.meta)

function fixtureContentDir() {
  return fileURLToPath(new URL('./content', import.meta.url))
}

async function createDbFromFS() {
  const source = new FSSource(fixtureContentDir())
  const db = new LocalDB(cms.config, source)
  await db.sync()
  return db
}

async function createDbFromExport() {
  const fsSource = new FSSource(fixtureContentDir())
  const exportedSource = await exportSource(fsSource)
  const memorySource = await importSource(exportedSource)
  const db = new LocalDB(cms.config, memorySource)
  await db.sync()
  return db
}

test('loads basic fixture content from exported source', async () => {
  const db = await createDbFromExport()
  const entries = await db.find({workspace: 'simple'})
  test.is(entries.length, 5)

  const home = await db.get({
    workspace: 'simple',
    type: cms.schema.Page,
    path: 'home'
  })
  test.is(home.title, 'Home')
})

test('loads fixture content from fs source', async () => {
  const db = await createDbFromFS()
  const entries = await db.find({workspace: 'many'})
  test.is(entries.length, 36)

  const checklist = await db.get({
    workspace: 'nested',
    type: cms.schema.Page,
    path: 'checklist'
  })
  test.is(checklist.title, 'Checklist')
  test.is(checklist._url, '/docs/guides/advanced/operations/weekly/checklist')
})

test('find returns all locales for i18n content', async () => {
  const db = await createDbFromFS()
  const homePerLocale = await db.find({
    workspace: 'i18n',
    path: 'home',
    status: 'all',
    select: {
      locale: Entry.locale
    }
  })
  const locales = homePerLocale
    .map(entry => entry.locale)
    .filter((locale): locale is string => locale !== null)
    .sort()
  test.equal(locales, ['de', 'en', 'fr'])
})

test('get/find expose mixed statuses', async () => {
  const db = await createDbFromFS()
  const statusRows = await db.find({
    workspace: 'statuses',
    status: 'all',
    select: {
      path: Entry.path,
      status: Entry.status
    }
  })
  const statusMap = new Map(
    statusRows.map(row => [`${row.path}:${row.status}`, true] as const)
  )
  test.is(statusMap.has('updated:published'), true)
  test.is(statusMap.has('updated:draft'), true)
  test.is(statusMap.has('archived-only:archived'), true)
})
