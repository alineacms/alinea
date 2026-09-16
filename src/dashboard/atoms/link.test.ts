import {expect, spyOn, test} from 'bun:test'
import {createStore, type Atom} from 'jotai'
import {Config, Field} from '#/index.js'
import {LocalDB} from '#/core/db/LocalDB.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {
  createDashboardAtomFixture,
  createDashboardStore
} from '#test/DashboardFixture.js'
import {entryAtoms} from './entry.js'
import {linkEntryAtoms, type LinkEntryState} from './link.js'
import {userPolicyReadyAtom} from './user.js'

type Store = ReturnType<typeof createStore>

function waitForChange(store: Store, value: Atom<LinkEntryState>) {
  return new Promise<void>(resolve => {
    const unsubscribe = store.sub(value, () => {
      unsubscribe()
      resolve()
    })
  })
}

test('batches link entry reads started in the same turn', async () => {
  const {child, db, parent, store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const resolve = spyOn(db, 'resolve')
  const parentEntry = linkEntryAtoms(parent._id)
  const childEntry = linkEntryAtoms(child._id)

  const changed = [
    waitForChange(store, parentEntry),
    waitForChange(store, childEntry)
  ]

  expect(store.get(parentEntry)).toEqual({state: 'loading'})
  expect(store.get(childEntry)).toEqual({state: 'loading'})
  await Promise.all(changed)

  expect(resolve).toHaveBeenCalledTimes(2)
  expect(resolve.mock.calls[0][0]).toMatchObject({
    id: {in: [parent._id, child._id]}
  })
  expect(resolve.mock.calls[1][0]).toMatchObject({
    parentId: {in: [parent._id, child._id]}
  })
  expect(store.get(parentEntry)).toMatchObject({
    state: 'hasData',
    data: {id: parent._id, title: 'Parent draft'}
  })
  expect(store.get(childEntry)).toMatchObject({
    state: 'hasData',
    data: {id: child._id, title: 'Child'}
  })
  resolve.mockRestore()
})

test('contains link entry load errors in the atom state', async () => {
  const {child, db, store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const error = new Error('Could not load link entry')
  const resolve = spyOn(db, 'resolve').mockRejectedValue(error)
  const linkEntry = linkEntryAtoms(child._id)

  const changed = waitForChange(store, linkEntry)

  expect(store.get(linkEntry)).toEqual({state: 'loading'})
  await changed

  expect(store.get(linkEntry)).toEqual({state: 'hasError', error})
  resolve.mockRestore()
})

test('represents missing link entries as empty data', async () => {
  const {store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const missing = linkEntryAtoms('missing-link-entry')
  const changed = waitForChange(store, missing)

  expect(store.get(missing)).toEqual({state: 'loading'})
  await changed

  expect(store.get(missing)).toEqual({state: 'hasData', data: null})
})

test('loads linked entry summaries in the locale stored on the link', async () => {
  const Page = Config.document('Page', {
    fields: {
      title: Field.text('Title'),
      body: Field.richText('Body')
    }
  })
  const config = Config.create({
    enableDrafts: true,
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {
          pages: Config.root('Pages', {
            contains: ['Page'],
            i18n: {locales: ['en', 'fr']}
          }),
          media: Config.media()
        }
      })
    }
  })
  const db = new LocalDB(config)
  await db.create({
    id: 'localized-link-parent',
    locale: 'en',
    root: 'pages',
    type: Page,
    set: {title: 'English parent'}
  })
  await db.create({
    id: 'localized-link-parent',
    locale: 'fr',
    root: 'pages',
    type: Page,
    set: {title: 'Parent français'}
  })
  await db.create({
    id: 'localized-link-target',
    locale: 'en',
    parentId: 'localized-link-parent',
    root: 'pages',
    type: Page,
    set: {
      title: 'English title',
      body: [
        {
          _type: 'heading',
          _anchor: 'english-section',
          content: [{_type: 'text', text: 'English section'}]
        }
      ]
    }
  })
  await db.create({
    id: 'localized-link-target',
    locale: 'fr',
    parentId: 'localized-link-parent',
    root: 'pages',
    type: Page,
    status: 'published',
    set: {
      title: 'Titre français publié',
      body: [
        {
          _type: 'heading',
          _anchor: 'section-francaise',
          content: [{_type: 'text', text: 'Section française'}]
        }
      ]
    }
  })
  await db.create({
    id: 'localized-link-target',
    locale: 'fr',
    parentId: 'localized-link-parent',
    root: 'pages',
    type: Page,
    status: 'draft',
    set: {
      title: 'Brouillon français',
      body: [
        {
          _type: 'heading',
          _anchor: 'section-francaise',
          content: [{_type: 'text', text: 'Section française'}]
        }
      ]
    }
  })
  await db.create({
    id: 'link-preview-file',
    root: 'media',
    type: MediaFile,
    set: {
      title: 'Preview file',
      path: 'preview-file',
      location: 'preview.jpg',
      extension: '.jpg',
      preview: 'data:image/jpeg;base64,preview'
    }
  })
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const target = await store.get(entryAtoms('localized-link-target'))
  store.set(target.locales('fr').selectedVersion, {
    type: 'status',
    status: 'published'
  })
  const english = linkEntryAtoms('localized-link-target', 'en')
  const french = linkEntryAtoms('localized-link-target', 'fr')
  const legacy = linkEntryAtoms('localized-link-target')
  const changed = [
    waitForChange(store, english),
    waitForChange(store, french),
    waitForChange(store, legacy)
  ]

  expect(store.get(english)).toEqual({state: 'loading'})
  expect(store.get(french)).toEqual({state: 'loading'})
  expect(store.get(legacy)).toEqual({state: 'loading'})
  await Promise.all(changed)

  expect(store.get(english)).toMatchObject({
    state: 'hasData',
    data: {title: 'English title'}
  })
  expect(store.get(french)).toMatchObject({
    state: 'hasData',
    data: {
      title: 'Brouillon français',
      parents: [{id: 'localized-link-parent', title: 'Parent français'}],
      anchors: [expect.objectContaining({id: 'section-francaise'})]
    }
  })
  expect(store.get(legacy)).toMatchObject({
    state: 'hasData',
    data: {title: 'English title'}
  })

  const preview = linkEntryAtoms('link-preview-file')
  const previewChanged = waitForChange(store, preview)
  expect(store.get(preview)).toEqual({state: 'loading'})
  await previewChanged
  expect(store.get(preview)).toMatchObject({
    state: 'hasData',
    data: {preview: 'data:image/jpeg;base64,preview'}
  })
})
