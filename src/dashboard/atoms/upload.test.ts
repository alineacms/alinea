import {MediaFile} from '#/core/media/MediaTypes.js'
import {createFileHash} from '#/core/util/ContentHash.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config} from '#/index.js'
import {
  createDashboardAtomFixture,
  createDashboardStore,
  DashboardTestPage
} from '#test/DashboardFixture.js'
import {expect, spyOn, test} from 'bun:test'
import {activityAtom} from './activity.js'
import {configAtom} from './core.js'
import {createExplorerAtoms} from './explorer.js'
import {
  cancelPendingUploadsAtom,
  confirmPendingUploadsAtom,
  pendingUploadsAtom,
  requestUploadsAtom,
  updatePendingUploadAtom,
  uploadFilesAtom
} from './upload.js'
import {userPolicyReadyAtom} from './user.js'

type Store = ReturnType<typeof createDashboardStore>

/** Resolves once the upload dialog asks about files */
function dialogOpened(store: Store) {
  return new Promise<void>(resolve => {
    if (store.get(pendingUploadsAtom)) return resolve()
    const unsubscribe = store.sub(pendingUploadsAtom, () => {
      if (!store.get(pendingUploadsAtom)) return
      unsubscribe()
      resolve()
    })
  })
}

test('reports invalid uploads while continuing with valid files', async () => {
  const {config, db, store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  store.set(configAtom, {...config, maxUploadSize: 5})
  const upload = spyOn(db, 'upload').mockResolvedValue(undefined as never)
  const valid = new File(['small'], 'valid.zip')
  const invalid = new File(['too large'], 'invalid.zip')

  await store.set(uploadFilesAtom, {
    workspace: 'main',
    root: 'pages',
    uploads: [{file: invalid}, {file: valid}]
  })

  expect(upload).toHaveBeenCalledTimes(1)
  expect(upload.mock.calls[0]?.[0].file).toBe(valid)
  const activity = store.get(activityAtom)
  const failedActivity = activity.items.filter(item => item.status === 'failed')
  expect(failedActivity).toContainEqual(
    expect.objectContaining({
      type: 'upload',
      status: 'failed',
      error: expect.stringContaining('invalid.zip'),
      upload: {workspace: 'main', root: 'pages', parentId: undefined}
    })
  )
  expect(failedActivity).toHaveLength(1)
  expect(activity.items).not.toContainEqual(
    expect.objectContaining({
      type: 'upload',
      status: 'running',
      operations: [expect.objectContaining({title: 'valid.zip'})]
    })
  )
})

test('explorer uploads wait for the upload dialog', async () => {
  const {db, store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const upload = spyOn(db, 'upload').mockResolvedValue({
    _id: 'uploaded'
  } as never)
  const explorer = createExplorerAtoms({workspace: 'main', root: 'pages'}, {})
  const file = new File(['pdf'], 'brochure.pdf')

  const cancelled = store.set(explorer.upload, [file])
  await dialogOpened(store)
  store.set(cancelPendingUploadsAtom)
  await cancelled
  expect(upload).not.toHaveBeenCalled()

  const confirmed = store.set(explorer.upload, [file])
  await dialogOpened(store)
  const pending = store.get(pendingUploadsAtom)!
  expect(pending.uploads.map(({file, action}) => [file.name, action])).toEqual([
    ['brochure.pdf', 'upload']
  ])
  await store.set(confirmPendingUploadsAtom)
  await confirmed
  expect(upload).toHaveBeenCalledTimes(1)
  expect(store.get(pendingUploadsAtom)).toBeUndefined()
})

test('files added while the dialog is open join the listed files', async () => {
  const {db, store} = await createDashboardAtomFixture()
  await store.get(userPolicyReadyAtom)
  const upload = spyOn(db, 'upload').mockImplementation(
    async query => ({_id: (query.file as File).name}) as never
  )
  const destination = {workspace: 'main', root: 'pages'}
  const request = (name: string, parentId?: string) =>
    store.set(requestUploadsAtom, {
      files: [new File(['pdf'], name)],
      destination: {...destination, parentId}
    })
  const first = request('first.pdf')
  await dialogOpened(store)
  const second = request('second.pdf')
  await new Promise<void>(resolve => {
    const unsubscribe = store.sub(pendingUploadsAtom, () => {
      if (store.get(pendingUploadsAtom)?.uploads.length !== 2) return
      unsubscribe()
      resolve()
    })
  })
  // Files for another folder can not join, the listed files stay
  expect(await request('elsewhere.pdf', 'folder')).toEqual([])
  const names = store
    .get(pendingUploadsAtom)!
    .uploads.map(upload => upload.file.name)
  expect(names).toEqual(['first.pdf', 'second.pdf'])
  await store.set(confirmPendingUploadsAtom)
  expect(await first).toEqual(['first.pdf', 'second.pdf'])
  expect(await second).toEqual(['first.pdf', 'second.pdf'])
  expect(upload).toHaveBeenCalledTimes(2)
})

test('files already in the media library are offered instead of uploaded', async () => {
  const config = Config.create({
    schema: {Page: DashboardTestPage},
    workspaces: {
      main: Config.workspace('Main', {
        source: '.',
        roots: {media: Config.media()}
      })
    }
  })
  const db = new LocalDB(config)
  await db.sync()
  const store = createDashboardStore(config, db)
  await store.get(userPolicyReadyAtom)
  const file = new File(['same bytes'], 'Price list.pdf')
  const hash = await createFileHash(new Uint8Array(await file.arrayBuffer()))
  const existing = await db.create({
    type: MediaFile,
    root: 'media',
    set: {
      title: 'Price list',
      path: 'price-list',
      location: '/price-list.pdf',
      extension: '.pdf',
      size: file.size,
      hash
    }
  })
  const upload = spyOn(db, 'upload')
  const destination = {workspace: 'main', root: 'media'}

  const used = store.set(requestUploadsAtom, {files: [file], destination})
  await dialogOpened(store)
  const [pending] = store.get(pendingUploadsAtom)!.uploads
  expect(pending.duplicate?.id).toBe(existing._id)
  // The same name in the same folder can be replaced
  expect(pending.conflict?.id).toBe(existing._id)
  expect(pending.action).toBe('existing')
  await store.set(confirmPendingUploadsAtom)
  expect(await used).toEqual([existing._id])
  expect(upload).not.toHaveBeenCalled()

  const replaced = store.set(requestUploadsAtom, {files: [file], destination})
  await dialogOpened(store)
  const {id} = store.get(pendingUploadsAtom)!.uploads[0]
  store.set(updatePendingUploadAtom, id, {action: 'replace'})
  upload.mockResolvedValue({_id: existing._id} as never)
  await store.set(confirmPendingUploadsAtom)
  expect(await replaced).toEqual([existing._id])
  expect(upload.mock.calls[0]?.[0].replaceId).toBe(existing._id)
})
