import {IndexEvent} from '#/core/db/IndexEvent.js'
import {Entry} from '#/core/Entry.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Config, Field} from '#/index.js'
import {
  createDashboardAtomFixture,
  createDashboardStore,
  TestEvents
} from '#test/DashboardFixture.js'
import {expect, spyOn, test} from 'bun:test'
import {atom} from 'jotai'
import {configAtom, eventsAtom} from './core.js'
import {EntryAtoms, entryAtoms, EntryLocaleAtoms} from './entry.js'
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

test('preloads linked rich text images without changing stored data', async () => {
  const Page = Config.document('Page', {
    fields: {body: Field.richText('Body')}
  })
  const config = Config.create({
    schema: {Page},
    baseUrl: 'http://localhost',
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        mediaUrl: '/media',
        roots: {
          pages: Config.root('Pages', {contains: [Page]}),
          media: Config.media()
        }
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  await db.create({
    id: 'media-1',
    type: MediaFile,
    root: 'media',
    set: {
      title: 'Image',
      path: 'image',
      location: 'image.jpg',
      extension: '.jpg',
      alt: {en: 'Resolved alt text'}
    }
  })
  const created = await db.create({
    id: 'page-1',
    type: Page,
    root: 'pages',
    set: {
      title: 'Page',
      body: [
        {
          _type: 'image',
          _id: 'image-1',
          _entry: 'media-1',
          _link: 'image'
        }
      ]
    }
  })
  const selectedEntry = await db.get({id: created._id, select: Entry})
  const entryDataAtom = atom({
    id: selectedEntry.id,
    type: selectedEntry.type,
    parentId: selectedEntry.parentId,
    workspace: selectedEntry.workspace,
    root: selectedEntry.root,
    hasChildren: false,
    parents: [],
    entries: [selectedEntry]
  })
  const entry = new EntryAtoms(selectedEntry.id, entryDataAtom)
  const store = createDashboardStore(config, db)

  const images = await store.get(entry.locales(null).richTextImages)

  expect(images.get('media-1')).toEqual({
    src: 'http://localhost/media/image.jpg',
    alt: 'Resolved alt text'
  })
  expect(selectedEntry.data.body).toEqual([
    {
      _type: 'image',
      _id: 'image-1',
      _entry: 'media-1',
      _link: 'image'
    }
  ])
})

test('publishing reconciles transaction-generated media aliases immediately', async () => {
  const config = Config.create({
    schema: {},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        mediaUrl: ({path, extension}) => `/assets/${path}${extension}`,
        roots: {
          media: Config.media({contains: ['MediaFile']})
        }
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  const created = await db.create({
    type: MediaFile,
    root: 'media',
    set: {
      title: 'File',
      path: 'original',
      metadata: {aliases: []},
      location: '/stored.jpg',
      extension: '.jpg',
      size: 1024,
      hash: 'file-hash'
    }
  })
  const store = createDashboardStore(config, db)
  await store.get(authReady)
  const entry = await store.get(entryAtoms(created._id))
  const locale = entry.locales(null)
  const node = await store.get(locale.selectedNode)
  store.set(locale.currentlyEditing, node)
  store.set(node.field('path'), 'updated')

  const mutate = db.mutate.bind(db)
  let notifyStarted: () => void
  let releaseSave!: () => void
  const started = new Promise<void>(resolve => {
    notifyStarted = resolve
  })
  const blocked = new Promise<void>(resolve => {
    releaseSave = resolve
  })
  const mutateSpy = spyOn(db, 'mutate').mockImplementation(async mutations => {
    notifyStarted()
    await blocked
    return mutate(mutations)
  })

  const saving = store.set(locale.publishEdits, node)
  await started
  store.set(node.field('title'), 'Typed while saving')
  releaseSave()
  await saving
  mutateSpy.mockRestore()

  expect(store.get(node.value)).toMatchObject({
    title: 'Typed while saving',
    metadata: {aliases: [{url: '/assets/original.jpg'}]}
  })
  expect(store.get(node.isDirty)).toBeTrue()

  store.set(node.reset)
  expect(store.get(node.value)).toMatchObject({
    title: 'File',
    path: 'updated',
    metadata: {aliases: [{url: '/assets/original.jpg'}]}
  })
  expect(store.get(node.isDirty)).toBeFalse()
})
