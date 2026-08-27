import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {expect, spyOn, test} from 'bun:test'
import {activityAtom} from './activity.js'
import {configAtom} from './core.js'
import {createExplorerAtoms} from './explorer.js'
import {authReady} from './user.js'

test('reports invalid uploads while continuing with valid files', async () => {
  const {config, db, store} = await createDashboardAtomFixture()
  await store.get(authReady)
  store.set(configAtom, {...config, maxUploadSize: 5})
  const upload = spyOn(db, 'upload').mockResolvedValue(undefined as never)
  const explorer = createExplorerAtoms({workspace: 'main', root: 'pages'}, {})
  const valid = new File(['small'], 'valid.jpg')
  const invalid = new File(['too large'], 'invalid.jpg')

  await store.set(explorer.upload, [invalid, valid])

  expect(upload).toHaveBeenCalledTimes(1)
  expect(upload.mock.calls[0]?.[0].file).toBe(valid)
  const activity = store.get(activityAtom)
  const failedActivity = activity.items.filter(item => item.status === 'failed')
  expect(failedActivity).toContainEqual(
    expect.objectContaining({
      type: 'upload',
      status: 'failed',
      error: expect.stringContaining('invalid.jpg'),
      upload: {workspace: 'main', root: 'pages', parentId: undefined}
    })
  )
  expect(failedActivity).toHaveLength(1)
  expect(activity.items).not.toContainEqual(
    expect.objectContaining({
      type: 'upload',
      status: 'running',
      operations: [expect.objectContaining({title: 'valid.jpg'})]
    })
  )
})
