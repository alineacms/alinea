import {suite} from '@alinea/suite'
import {Edit} from 'alinea'
import {LocalDB} from 'alinea/core/db/LocalDB'
import {config} from './example.js'

const test = suite(import.meta)

const {Page} = config.schema

async function createDb() {
  const db = new LocalDB(config)
  await db.sync()
  return db
}

test('filters out missing entry links for current status', async () => {
  const db = await createDb()

  const publishedTarget = await db.create({
    type: Page,
    set: {title: 'Published target'}
  })
  const draftTarget = await db.create({
    type: Page,
    status: 'draft',
    set: {title: 'Draft target'}
  })

  const source = await db.create({
    type: Page,
    set: {
      title: 'Source',
      entryLink: Edit.links(Page.entryLink)
        .addEntry(publishedTarget._id)
        .addEntry(draftTarget._id)
        .value()
    }
  })

  const result = await db.get({
    type: Page,
    id: source._id,
    select: {
      entryLink: Page.entryLink
    }
  })

  test.is(result.entryLink.length, 1)
  test.is((result.entryLink[0] as any).entryId, publishedTarget._id)
})
