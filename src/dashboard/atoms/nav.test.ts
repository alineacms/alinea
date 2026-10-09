import {expect, test} from 'bun:test'
import {LocalDB} from '#/database/LocalDB.js'
import {Policy} from '#/core/Role.js'
import {localUser} from '#/core/User.js'
import {
  createDashboardStore,
  DashboardTestPage
} from '#test/DashboardFixture.js'
import {Config} from '#/index.js'
import {pageAtom, routeAtom} from './nav.js'
import {preloadUserPolicyAtom} from './user.js'

function dashboardStore(workspaces: 1 | 2) {
  const config = Config.create({
    schema: {Page: DashboardTestPage},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content/main',
        roots: {pages: Config.root('Pages', {contains: ['Page']})}
      }),
      ...(workspaces === 2
        ? {
            secondary: Config.workspace('Secondary', {
              source: 'content/secondary',
              roots: {
                pages: Config.root('Pages', {contains: ['Page']})
              }
            })
          }
        : {})
    }
  })
  const store = createDashboardStore(config, new LocalDB(config))
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  return store
}

test('skips the splash for a single readable workspace', () => {
  const store = dashboardStore(1)
  store.set(routeAtom, {browser: true, route: {page: 'splash'}})

  expect(store.get(pageAtom)).toMatchObject({
    type: 'entry',
    workspace: 'main',
    root: 'pages'
  })
})

test('shows the splash for multiple readable workspaces', () => {
  const store = dashboardStore(2)
  store.set(routeAtom, {browser: true, route: {page: 'splash'}})

  expect(store.get(pageAtom)).toMatchObject({
    type: 'splash',
    workspace: undefined,
    root: undefined
  })
})

test('keeps workspace context on the users page', () => {
  const store = dashboardStore(2)
  store.set(routeAtom, {browser: true, route: {page: 'users'}})

  expect(store.get(pageAtom)).toMatchObject({
    type: 'users',
    workspace: 'main'
  })
})

test('opens the root marked openByDefault without a requested root', () => {
  const config = Config.create({
    schema: {Page: DashboardTestPage},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content/main',
        roots: {
          pages: Config.root('Pages', {contains: ['Page']}),
          articles: Config.root('Articles', {
            contains: ['Page'],
            openByDefault: true
          })
        }
      })
    }
  })
  const store = createDashboardStore(config, new LocalDB(config))
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  store.set(routeAtom, {
    browser: true,
    route: {page: 'entry', workspace: 'main'}
  })
  expect(store.get(pageAtom).root).toBe('articles')
  store.set(routeAtom, {
    browser: true,
    route: {page: 'entry', workspace: 'main', root: 'pages'}
  })
  expect(store.get(pageAtom).root).toBe('pages')
})

async function linkedStore() {
  const config = Config.create({
    schema: {Page: DashboardTestPage},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content/main',
        roots: {
          pages: Config.root('Pages', {
            contains: ['Page'],
            i18n: {locales: ['en', 'nl']}
          })
        }
      })
    }
  })
  const db = new LocalDB(config)
  await db.mutate([
    {
      op: 'create',
      id: 'hero',
      type: 'Page',
      workspace: 'main',
      root: 'pages',
      locale: 'nl',
      status: 'published',
      data: {title: 'Hero', path: 'hero'}
    }
  ])
  const store = createDashboardStore(config, db)
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  return {db, store}
}

async function follow(store: ReturnType<typeof dashboardStore>, url: string) {
  await store.set(routeAtom, {page: 'edit', url})
  return store.get(pageAtom)
}

test('opens the entry an edit link names by url', async () => {
  const {store} = await linkedStore()
  expect(await follow(store, '/nl/hero')).toMatchObject({
    type: 'entry',
    workspace: 'main',
    root: 'pages',
    entry: 'hero',
    locale: 'nl'
  })
})

test('opens an edit link with a trailing slash or encoded path', async () => {
  const {store} = await linkedStore()
  expect((await follow(store, '/nl/hero/')).entry).toBe('hero')
  expect((await follow(store, '/nl/h%65ro')).entry).toBe('hero')
})

test('opens the entry an edit link names by a former url', async () => {
  const {db, store} = await linkedStore()
  await db.mutate([
    {
      op: 'update',
      id: 'hero',
      locale: 'nl',
      status: 'published',
      set: {path: 'heroes'}
    }
  ])
  expect((await follow(store, '/nl/hero')).entry).toBe('hero')
})

test('opens the splash for an edit link to an unknown url', async () => {
  const {store} = await linkedStore()
  expect(await follow(store, '/nl/missing')).toMatchObject({
    entry: undefined
  })
})

test('looks up an edit link in the root it names', async () => {
  const {store} = await linkedStore()
  await store.set(routeAtom, {page: 'edit', url: '/nl/hero', root: 'pages'})
  expect(store.get(pageAtom).entry).toBe('hero')
  await store.set(routeAtom, {page: 'edit', url: '/nl/hero', root: 'other'})
  expect(store.get(pageAtom).entry).toBeUndefined()
})

test('keeps a navigation made while an edit link is looked up', async () => {
  const {store} = await linkedStore()
  const lookup = store.set(routeAtom, {page: 'edit', url: '/nl/hero'})
  store.set(routeAtom, {page: 'users'})
  await lookup
  expect(store.get(pageAtom).type).toBe('users')
})
