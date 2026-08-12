import {expect, spyOn, test} from 'bun:test'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {atom, createStore} from 'jotai'
import type {Entry} from '#/core/Entry.js'
import {Config, Field} from '#/index.js'
import {createDashboardAtomFixture, TestEvents} from '#test/DashboardFixture.js'
import {configAtom, eventsAtom} from './core.js'
import {EntryAtoms, EntryLocaleAtoms, entryAtoms} from './entry.js'
import {authReady} from './user.js'

test('entryAtoms returns stable entry and locale atom bundles', () => {
  const entry = new EntryAtoms('entry-id', atom({} as never))

  expect(entry).toBeInstanceOf(EntryAtoms)
  expect(entryAtoms('entry-id')).toBe(entryAtoms('entry-id'))
  expect(entry.locales('en')).toBeInstanceOf(EntryLocaleAtoms)
  expect(entry.locales('en')).toBe(entry.locales('en'))
  expect(entry.locales('fr')).not.toBe(entry.locales('en'))
})

test('entry atoms only reload for matching index event ids', async () => {
  const {db, parent, child, store} = await createDashboardAtomFixture()
  const events = new TestEvents()
  store.set(eventsAtom, events)
  await store.get(authReady)
  const resolve = spyOn(db, 'resolve')
  const parentAtom = entryAtoms(parent._id)
  const childAtom = entryAtoms(child._id)
  const unsubscribeParent = store.sub(parentAtom, () => {})
  const unsubscribeChild = store.sub(childAtom, () => {})
  await Promise.all([store.get(parentAtom), store.get(childAtom)])
  resolve.mockClear()

  events.emit(
    new IndexEvent({op: 'index', sha: 'unrelated-sha', ids: ['unrelated']})
  )
  await Promise.resolve()
  expect(resolve).not.toHaveBeenCalled()

  events.emit(
    new IndexEvent({op: 'index', sha: 'parent-sha', ids: [parent._id]})
  )
  await store.get(parentAtom)
  await Promise.resolve()

  expect(resolve).toHaveBeenCalledTimes(2)
  expect(resolve.mock.calls[0][0]).toMatchObject({id: {in: [parent._id]}})
  expect(resolve.mock.calls[1][0]).toMatchObject({
    parentId: {in: [parent._id]}
  })

  unsubscribeParent()
  unsubscribeChild()
  resolve.mockRestore()
})

test('currently editing nodes preserve arbitrary JSON values', async () => {
  const Page = Config.document('Page', {
    fields: {
      title: Field.text('Title'),
      payload: Field.json<Record<string, boolean>>('Payload')
    }
  })
  const config = Config.create({
    schema: {Page},
    workspaces: {}
  })
  const payload = {__alinea_undefined_editor_value__: true}
  const selectedEntry: Entry = {
    active: true,
    childrenDir: '',
    data: {title: 'Entry', payload},
    fileHash: '',
    filePath: '',
    id: 'entry-id',
    index: 'a0',
    level: 0,
    locale: null,
    main: true,
    parentDir: '',
    parentId: null,
    parents: [],
    path: 'entry',
    root: 'pages',
    rowHash: '',
    searchableText: '',
    seeded: null,
    status: 'published',
    title: 'Entry',
    type: 'Page',
    url: '/entry',
    workspace: 'main'
  }
  const entryData = {
    id: selectedEntry.id,
    type: selectedEntry.type,
    parentId: selectedEntry.parentId,
    workspace: selectedEntry.workspace,
    root: selectedEntry.root,
    hasChildren: false,
    parents: [],
    entries: [selectedEntry]
  }
  const entryDataAtom = atom(entryData)
  const entry = new EntryAtoms(selectedEntry.id, entryDataAtom)
  const {store} = await createDashboardAtomFixture()
  store.set(configAtom, config)
  await store.get(authReady)

  const selectedNode = entry.locales(null).selectedNode
  const first = await store.get(selectedNode)
  const second = await store.get(selectedNode)
  const value = store.get(first.value) as Record<string, unknown>

  expect(second).toBe(first)
  expect(value.payload).toEqual(payload)

  store.set(entry.locales(null).currentlyEditing, first)
  store.set(entryDataAtom, {
    ...entryData,
    entries: [{...selectedEntry, data: {...selectedEntry.data}}]
  })
  const retained = await store.get(selectedNode)
  expect(retained).toBe(first)

  const nextPayload = {updated: true}
  store.set(entry.locales(null).currentlyEditing, undefined)
  store.set(entryDataAtom, {
    ...entryData,
    entries: [
      {
        ...selectedEntry,
        data: {...selectedEntry.data, payload: nextPayload},
        fileHash: 'updated',
        rowHash: 'updated'
      }
    ]
  })
  const updated = await store.get(selectedNode)
  const updatedValue = store.get(updated.value) as Record<string, unknown>
  expect(updated).not.toBe(first)
  expect(updatedValue.payload).toEqual(nextPayload)
})
