import {Config, Field} from '#/index.js'
import {LocalDB} from '#/core/db/LocalDB.js'

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

export class TestEvents {
  listeners = new Set<EventListenerOrEventListenerObject>()

  addEventListener(
    _type: string,
    listener: EventListenerOrEventListenerObject
  ) {
    this.listeners.add(listener)
  }

  removeEventListener(
    _type: string,
    listener: EventListenerOrEventListenerObject
  ) {
    this.listeners.delete(listener)
  }

  emit(event: Event) {
    for (const listener of this.listeners) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
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
  return {config: dashboardTestConfig, db, parent, child}
}
