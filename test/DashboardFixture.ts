import {Config, Field} from '#/index.js'
import type {Config as ConfigDefinition} from '#/core/Config.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {
  alineaDevAtom,
  clientAtom,
  configAtom,
  eventsAtom,
  graphAtom,
  localAtom,
  viewsAtom
} from '#/dashboard/atoms/core.js'
import {createTestConnection} from './CreateConnection.js'
import {createStore} from 'jotai'

export const DashboardTestPage = Config.document('Page', {
  contains: ['Page'],
  fields: {
    title: Field.text('Title')
  }
})

const main = Config.workspace('Main', {
  source: '.',
  roots: {
    pages: Config.root('Pages', {contains: ['Page']})
  }
})

export const dashboardTestConfig = Config.create({
  schema: {Page: DashboardTestPage},
  workspaces: {main}
})

export function createDashboardStore(
  config: ConfigDefinition,
  db: LocalDB
) {
  const store = createStore()
  store.set(configAtom, config)
  store.set(graphAtom, db)
  store.set(eventsAtom, new EventTarget())
  store.set(clientAtom, createTestConnection(db))
  store.set(localAtom, true)
  store.set(alineaDevAtom, false)
  store.set(viewsAtom, {})
  return store
}

export class TestEvents implements EventTarget {
  readonly #listeners = new Map<
    string,
    Set<EventListenerOrEventListenerObject>
  >()

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null
  ) {
    if (!callback) return
    const listeners = this.#listeners.get(type)
    if (listeners) listeners.add(callback)
    else this.#listeners.set(type, new Set([callback]))
  }

  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null
  ) {
    if (callback) this.#listeners.get(type)?.delete(callback)
  }

  dispatchEvent(event: Event): boolean {
    for (const listener of this.#listeners.get(event.type) ?? []) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
    return !event.defaultPrevented
  }

  emit(event: Event): boolean {
    return this.dispatchEvent(event)
  }
}

export async function createDashboardAtomFixture() {
  const db = new LocalDB(dashboardTestConfig)
  await db.sync()
  const parent = await db.create({
    type: DashboardTestPage,
    set: {title: 'Parent'}
  })
  const child = await db.create({
    type: DashboardTestPage,
    parentId: parent._id,
    set: {title: 'Child'}
  })
  await db.create({
    type: DashboardTestPage,
    id: parent._id,
    status: 'draft',
    overwrite: true,
    set: {title: 'Parent draft'}
  })
  const store = createDashboardStore(dashboardTestConfig, db)
  return {config: dashboardTestConfig, db, parent, child, store}
}
