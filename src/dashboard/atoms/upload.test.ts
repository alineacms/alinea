import {Policy} from '#/core/Role.js'
import {createDashboardAtomFixture} from '#test/DashboardFixture.js'
import {expect, spyOn, test} from 'bun:test'
import {configAtom} from './core.js'
import {dashboardAtoms} from './dashboard.js'
import {createExplorerAtoms} from './explorer.js'

test('reports invalid uploads while continuing with valid files', async () => {
  const {config, db, store} = await createDashboardAtomFixture()
  store.set(configAtom, {...config, maxUploadSize: 5})
  const upload = spyOn(db, 'upload').mockResolvedValue(undefined as never)
  const explorer = createExplorerAtoms(
    {workspace: 'main', root: 'pages'},
    {policy: Policy.ALLOW_ALL}
  )
  const valid = new File(['small'], 'valid.jpg')
  const invalid = new File(['too large'], 'invalid.jpg')

  await store.set(explorer.upload, [invalid, valid])

  expect(upload).toHaveBeenCalledTimes(1)
  expect(upload.mock.calls[0]?.[0].file).toBe(valid)
  expect(store.get(dashboardAtoms.mutationQueue).entries).toEqual([
    expect.objectContaining({
      status: 'failed',
      error: expect.stringContaining('invalid.jpg'),
      upload: {workspace: 'main', root: 'pages', parentId: undefined}
    })
  ])
})
