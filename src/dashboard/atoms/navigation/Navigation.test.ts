import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import type {Route} from '../../DashboardNav.js'
import type {RouteHistory} from './History.js'
import {createNavigation} from './Navigation.js'

interface Deferred<Value> {
  promise: Promise<Value>
  resolve(value: Value): void
  reject(error: Error): void
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return {promise, resolve, reject}
}

interface HistoryFixture extends RouteHistory {
  pushed: Array<Route>
  replaced: Array<Route>
  pop(route: Route): void
}

function historyFixture(initial: Route): HistoryFixture {
  const listeners = new Set<(route: Route) => void>()
  const pushed: Array<Route> = []
  const replaced: Array<Route> = []
  return {
    pushed,
    replaced,
    read() {
      return initial
    },
    push(route) {
      pushed.push(route)
    },
    replace(route) {
      replaced.push(route)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    pop(route) {
      for (const listener of listeners) listener(route)
    }
  }
}

test('keeps the current route until preparation completes', async () => {
  const history = historyFixture({page: 'entry', entry: 'before'})
  const preparation = deferred<void>()
  const navigation = createNavigation({
    history,
    prepare: () => preparation.promise
  })
  const store = createStore()
  const target: Route = {page: 'entry', entry: 'after'}

  const result = store.set(navigation.route, target)
  await Promise.resolve()

  expect(store.get(navigation.route)).toEqual({
    page: 'entry',
    entry: 'before'
  })
  expect(store.get(navigation.pending)?.route).toEqual(target)
  expect(history.pushed).toEqual([])

  preparation.resolve()
  expect(await result).toBe(true)
  expect(store.get(navigation.route)).toEqual(target)
  expect(store.get(navigation.pending)).toBeUndefined()
  expect(history.pushed).toEqual([target])
})

test('commits prepared page data with the route', async () => {
  const store = createStore()
  const history = historyFixture({
    page: 'entry',
    workspace: 'main',
    root: 'content',
    entry: 'before'
  })
  const preparation = deferred<string>()
  const navigation = createNavigation({
    history,
    prepare: () => preparation.promise
  })
  const observed: Array<[string | undefined, string]> = []
  const unsubscribe = store.sub(navigation.route, () => {
    observed.push([
      store.get(navigation.route).entry,
      store.get(navigation.prepared) ?? 'before'
    ])
  })

  const result = store.set(navigation.route, {
    page: 'entry',
    workspace: 'main',
    root: 'content',
    entry: 'after'
  })
  expect(store.get(navigation.prepared)).toBeUndefined()

  preparation.resolve('after')
  expect(await result).toBe(true)
  expect(observed).toEqual([['after', 'after']])
  unsubscribe()
})

test('does not refresh prepared data for an obsolete route', async () => {
  const initial: Route = {page: 'entry', entry: 'before'}
  const target: Route = {page: 'entry', entry: 'after'}
  const navigation = createNavigation<string>({
    history: historyFixture(initial),
    prepare: async () => 'after'
  })
  const store = createStore()
  store.set(navigation.prepared, 'before')

  expect(await store.set(navigation.route, target)).toBe(true)
  expect(store.get(navigation.prepared)).toBe('after')
  expect(store.set(navigation.refresh, initial, 'stale')).toBe(false)
  expect(store.get(navigation.prepared)).toBe('after')
})

test('only commits the latest navigation', async () => {
  const history = historyFixture({page: 'entry'})
  const first = deferred<void>()
  const second = deferred<void>()
  const navigation = createNavigation({
    history,
    prepare(route) {
      return route.entry === 'first' ? first.promise : second.promise
    }
  })
  const store = createStore()

  const firstResult = store.set(navigation.route, {
    page: 'entry',
    entry: 'first'
  })
  await Promise.resolve()
  const secondResult = store.set(navigation.route, {
    page: 'entry',
    entry: 'second'
  })
  await Promise.resolve()

  first.resolve()
  expect(await firstResult).toBe(false)
  expect(history.pushed).toEqual([])

  second.resolve()
  expect(await secondResult).toBe(true)
  expect(store.get(navigation.route).entry).toBe('second')
  expect(history.pushed.map(route => route.entry)).toEqual(['second'])
})

test('retains the current route when preparation fails', async () => {
  const history = historyFixture({page: 'entry', entry: 'before'})
  const navigation = createNavigation({
    history,
    prepare() {
      return Promise.reject(new Error('Unable to prepare page'))
    }
  })
  const store = createStore()

  expect(
    await store.set(navigation.route, {page: 'entry', entry: 'after'})
  ).toBe(false)
  expect(store.get(navigation.route).entry).toBe('before')
  expect(store.get(navigation.error)?.message).toBe('Unable to prepare page')
  expect(history.pushed).toEqual([])
})

test('does not prepare a blocked navigation', async () => {
  const history = historyFixture({page: 'entry'})
  let preparations = 0
  const navigation = createNavigation({
    history,
    allow: () => false,
    prepare() {
      preparations++
      return Promise.resolve()
    }
  })
  const store = createStore()

  expect(
    await store.set(navigation.route, {page: 'entry', entry: 'blocked'})
  ).toBe(false)
  expect(preparations).toBe(0)
  expect(store.get(navigation.pending)).toBeUndefined()
})

test('a blocked navigation cancels an earlier pending navigation', async () => {
  const history = historyFixture({page: 'entry'})
  const preparation = deferred<void>()
  const navigation = createNavigation({
    history,
    allow: route => route.entry !== 'blocked',
    prepare: () => preparation.promise
  })
  const store = createStore()

  const first = store.set(navigation.route, {
    page: 'entry',
    entry: 'pending'
  })
  await Promise.resolve()
  expect(store.get(navigation.pending)?.route.entry).toBe('pending')

  expect(
    await store.set(navigation.route, {page: 'entry', entry: 'blocked'})
  ).toBe(false)
  expect(store.get(navigation.pending)).toBeUndefined()

  preparation.resolve()
  expect(await first).toBe(false)
  expect(history.pushed).toEqual([])
})

test('prepares browser history changes before committing them', async () => {
  const initial: Route = {page: 'entry', entry: 'before'}
  const target: Route = {page: 'entry', entry: 'after'}
  const history = historyFixture(initial)
  const preparation = deferred<void>()
  const navigation = createNavigation({
    history,
    prepare: () => preparation.promise
  })
  const store = createStore()
  const unsubscribe = store.sub(navigation.route, () => {})

  history.pop(target)
  await Promise.resolve()
  expect(store.get(navigation.route)).toEqual(initial)
  expect(store.get(navigation.pending)?.route).toEqual(target)

  preparation.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(store.get(navigation.route)).toEqual(target)
  expect(history.pushed).toEqual([])

  unsubscribe()
})
