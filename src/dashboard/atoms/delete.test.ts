import {Entry} from '#/core/Entry.js'
import {Policy, WriteablePolicy} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {localUser} from '#/core/User.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Edit, Field} from '#/index.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {createDashboardStore} from '#test/DashboardFixture.js'
import {expect, test} from 'bun:test'
import {
  archiveEntriesAtom,
  deleteEntriesAtom,
  loadDeletePlanAtom,
  type DeleteSubject
} from './delete.js'
import {eventsAtom} from './core.js'
import {incomingReferencesAtoms} from './entry.js'
import {preloadUserPolicyAtom, userPolicyReadyAtom} from './user.js'

const Page = Config.document('Page', {
  contains: ['Page'],
  fields: {link: Field.entry('Link')}
})

const other = Config.root('Other', {contains: ['Page']})

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
        other
      }
    })
  }
})

async function fixture() {
  const db = new LocalDB(config)
  await db.sync()
  for (const locale of ['en', 'nl']) {
    await db.create({type: Page, id: 'test', locale, set: {title: 'Test'}})
    // Links from entries that are deleted too do not break
    await db.create({
      type: Page,
      id: 'child',
      parentId: 'test',
      locale,
      set: {
        title: `Child ${locale}`,
        link: Edit.link(Page.link).addEntry('test').value()
      }
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
  expect(plan.locales).toBeUndefined()
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

test('the dialog warns about links to the entries deleted with it', async () => {
  const {db, store} = await fixture()
  await db.create({
    type: Page,
    id: 'childLink',
    root: 'other',
    set: {
      title: 'Child link',
      link: Edit.link(Page.link).addEntry('child').value()
    }
  })
  const plan = await store.set(loadDeletePlanAtom, [subject], ['en', 'nl'])
  expect(sources(store.get(plan.references))).toEqual([
    'Child link',
    'Home en',
    'Plain'
  ])
})

test('references are reloaded when another entry links to the entry', async () => {
  const {db, store} = await fixture()
  const references = incomingReferencesAtoms('child')
  const unsubscribe = store.sub(references, () => {})
  expect((await store.get(references)).references).toEqual([])
  await db.create({
    type: Page,
    id: 'childLink',
    root: 'other',
    set: {
      title: 'Child link',
      link: Edit.link(Page.link).addEntry('child').value()
    }
  })
  store
    .get(eventsAtom)
    .dispatchEvent(
      new IndexEvent({op: 'index', sha: 'next', ids: ['childLink']})
    )
  expect(sources((await store.get(references)).references)).toEqual([
    'Child link'
  ])
  unsubscribe()
})

test('published entries can be archived instead, in the picked languages', async () => {
  const {db, store} = await fixture()
  const plan = await store.set(loadDeletePlanAtom, [subject], ['en', 'nl'])
  expect(store.get(plan.archivable)).toBe(true)
  store.set(plan.selectedLocales, ['en', 'nl'])
  await store.set(archiveEntriesAtom, plan)
  const statuses = await db.find({
    id: 'test',
    status: 'all',
    select: {locale: Entry.locale, status: Entry.status}
  })
  expect(statuses.map(row => `${row.locale} ${row.status}`).sort()).toEqual([
    'en archived',
    'nl archived'
  ])
  // Archived entries are not archived again
  const next = await store.set(loadDeletePlanAtom, [subject], ['en', 'nl'])
  expect(store.get(next.archivable)).toBe(false)
})

test('only entries that are all published can be archived instead', async () => {
  const {db, store} = await fixture()
  await db.archive({id: 'test', locale: 'nl'})
  const plan = await store.set(loadDeletePlanAtom, [subject], ['en', 'nl'])
  expect(store.get(plan.archivable)).toBe(true)
  store.set(plan.selectedLocales, ['en', 'nl'])
  expect(store.get(plan.archivable)).toBe(false)
  store.set(plan.selectedLocales, [])
  expect(store.get(plan.archivable)).toBe(false)

  const plain: DeleteSubject = {
    ...subject,
    id: 'plain',
    root: 'other',
    locale: null,
    hasChildren: false
  }
  const batch = await store.set(loadDeletePlanAtom, [subject, plain])
  expect(store.get(batch.archivable)).toBe(true)
  const archived = await store.set(loadDeletePlanAtom, [
    {...subject, locale: 'nl'},
    plain
  ])
  expect(store.get(archived.archivable)).toBe(false)

  const policy = new WriteablePolicy(getScope(config))
    .allowAll()
    .set({root: other, deny: {archive: true}})
  store.set(preloadUserPolicyAtom, localUser, policy)
  const denied = await store.set(loadDeletePlanAtom, [subject, plain])
  expect(store.get(denied.archivable)).toBe(false)
})

test('links from entries the user can not read are counted, not listed', async () => {
  const {db, store} = await fixture()
  await db.create({
    type: Page,
    id: 'secret',
    root: 'other',
    set: {
      title: 'Secret',
      link: Edit.link(Page.link).addEntry('child').value()
    }
  })
  const policy = new WriteablePolicy(getScope(config))
    .allowAll()
    .set({root: other, deny: {read: true}})
  store.set(preloadUserPolicyAtom, localUser, policy)
  const plan = await store.set(loadDeletePlanAtom, [subject], ['en', 'nl'])
  expect(sources(store.get(plan.references))).toEqual(['Home en'])
  // Plain and Secret, which links to the child deleted with the entry
  expect(store.get(plan.hiddenSources)).toBe(2)
  store.set(plan.selectedLocales, [])
  expect(store.get(plan.hiddenSources)).toBe(0)
})

test('an entry shown in a language it is not translated in picks none', async () => {
  const {store} = await fixture()
  const plan = await store.set(
    loadDeletePlanAtom,
    [{...subject, locale: 'fr'}],
    ['en', 'nl']
  )
  expect(plan.locales).toEqual(['en', 'nl'])
  expect(store.get(plan.selectedLocales)).toEqual([])
  expect(store.get(plan.removals)).toEqual([])
})
