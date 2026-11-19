import {Entry} from '#/core/Entry.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Edit} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {createEntryAtom} from './create.js'
import {userPolicyReadyAtom} from './user.js'

test('entries copied from another leave out its URL aliases', async () => {
  const Page = Config.document('Page', {fields: {}})
  const config = Config.create({
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {pages: Config.root('Pages', {contains: ['Page']})}
      })
    }
  })
  const db = new LocalDB(config)
  const source = await db.create({
    type: Page,
    root: 'pages',
    set: {title: 'Source'}
  })
  await db.update({
    id: source._id,
    set: {
      metadata: {
        ...source.metadata,
        title: 'Source meta title',
        aliases: Edit.list(Page.metadata.aliases)
          .add('alias', {url: '/old-source'})
          .value()
      }
    }
  })
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const created = await store.set(createEntryAtom, {
    workspace: 'main',
    root: 'pages',
    locale: null,
    type: 'Page',
    title: 'Copy',
    copyFrom: source._id
  })
  const copy = await db.get({
    id: created._id,
    status: 'preferDraft',
    select: {aliases: Entry.aliases, data: Entry.data}
  })
  expect(copy.aliases ?? []).toEqual([])
  // Other metadata is still copied
  expect(copy.data).toMatchObject({metadata: {title: 'Source meta title'}})
})
