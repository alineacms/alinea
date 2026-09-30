import {Entry} from '#/core/Entry.js'
import {Policy, WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {localUser} from '#/core/User.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Edit, Field} from '#/index.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {
  deleteEntriesAtom,
  loadDeletePlanAtom,
  type DeleteSubject
} from './delete.js'
import {preloadUserPolicyAtom, userPolicyReadyAtom} from './user.js'

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {link: Field.entry('Link')}
})

const config = Config.create({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: '.',
      roots: {
        pages: Config.root('Pages', {
          contains: ['Page'],
          i18n: {locales: ['en', 'nl']}
        }),
        other: Config.root('Other', {contains: ['Page']})
      }
    })
  }
})

async function fixture() {
  const db = new LocalDB(config)
  await db.sync()
  for (const locale of ['en', 'nl']) {
    await db.create({type: Page, id: 'test', locale, set: {title: 'Test'}})
    await db.create({
      type: Page,
      id: 'child',
      parentId: 'test',
      locale,
      set: {title: 'Child'}
    })
    await db.create({
      type: Page,
      id: 'home',
      locale,
      set: {
        title: `Home ${locale}`,
        link: Edit.link(Page.link).addEntry('test').value()
      }
    })
  }
  await db.create({
    type: Page,
    id: 'plain',
    root: 'other',
    set: {title: 'Plain', link: Edit.link(Page.link).addEntry('test').value()}
  })
  const store = createDashboardStore(config, db)
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  await store.get(userPolicyReadyAtom)
  async function versions() {
    const rows = await db.find({
      id: {in: ['test', 'child']},
      status: 'all',
      select: {id: Entry.id, locale: Entry.locale}
    })
    return rows.map(row => `${row.id} ${row.locale}`).sort()
  }
  return {db, store, versions}
}

const subject: DeleteSubject = {
  id: 'test',
  title: 'Test',
  type: 'Page',
  workspace: 'main',
  root: 'pages',
  locale: 'en',
  parents: [],
  hasChildren: true
}

function sources(references: Array<{source: {title: string}}>) {
  return references.map(item => item.source.title).sort()
}

test('the dialog deletes the shown language and warns about its links', async () => {
  const {store, versions} = await fixture()
  const plan = await store.set(loadDeletePlanAtom, [subject], ['en', 'nl'])
  expect(plan.locales).toEqual(['en', 'nl'])
  expect(store.get(plan.selectedLocales)).toEqual(['en'])
  expect(store.get(plan.removals)).toEqual([{id: 'test', locale: 'en'}])
  // Sources without languages can link to any language
  expect(sources(store.get(plan.references))).toEqual(['Home en', 'Plain'])

  store.set(plan.selectedLocales, [])
  expect(store.get(plan.removals)).toEqual([])
  store.set(plan.selectedLocales, ['nl'])
  expect(sources(store.get(plan.references))).toEqual(['Home nl', 'Plain'])

  await store.set(deleteEntriesAtom, plan)
  expect(await versions()).toEqual(['child en', 'test en'])
})

test('deleting every language removes the entry and its children', async () => {
  const {store, versions} = await fixture()
  const plan = await store.set(loadDeletePlanAtom, [subject], ['en', 'nl'])
  store.set(plan.selectedLocales, ['en', 'nl'])
  expect(sources(store.get(plan.references))).toEqual([
    'Home en',
    'Home nl',
    'Plain'
  ])
  await store.set(deleteEntriesAtom, plan)
  expect(await versions()).toEqual([])
})

test('a batch deletes entries in the language they are listed in', async () => {
  const {db, store, versions} = await fixture()
  const plain: DeleteSubject = {
    ...subject,
    id: 'plain',
    root: 'other',
    locale: null,
    hasChildren: false
  }
  const plan = await store.set(loadDeletePlanAtom, [subject, plain])
  expect(plan.locales).toEqual([])
  expect(store.get(plan.removals)).toEqual([
    {id: 'test', locale: 'en'},
    {id: 'plain', locale: null}
  ])
  await store.set(deleteEntriesAtom, plan)
  expect(await versions()).toEqual(['child nl', 'test nl'])
  expect(await db.first({id: 'plain', status: 'all'})).toBe(null)
})

test('only languages the user can delete are offered', async () => {
  const {store} = await fixture()
  const policy = new WriteablePolicy(getScope(config))
    .allowAll()
    .set({locale: 'nl', deny: {delete: true}})
  store.set(preloadUserPolicyAtom, localUser, policy)
  const plan = await store.set(loadDeletePlanAtom, [subject], ['en', 'nl'])
  expect(plan.locales).toEqual(['en'])
})
