import '../dom.js'
import {suite} from '@alinea/suite'
import {cleanup, fireEvent, render} from '@testing-library/react'
import {atom} from 'jotai'
import type {Dashboard} from '../store/Dashboard.js'
import {MutationQueueStatus} from './MutationQueueStatus.js'

const test = suite(import.meta)

function testDashboard(): Dashboard {
  return {
    mutationQueue: atom({
      entries: [
        {
          id: 'upload',
          status: 'syncing',
          mutations: [
            {
              op: 'uploadFile',
              title: 'photo.png',
              progress: {loaded: 50, total: 100}
            }
          ]
        }
      ],
      pending: 0,
      syncing: 1,
      failed: 0,
      blocked: 0
    }),
    retryMutationQueue: atom(null, () => undefined),
    discardMutationQueue: atom(null, () => undefined)
  } as unknown as Dashboard
}

test('MutationQueueStatus opens the queue popover from a custom label', async () => {
  const view = render(
    <MutationQueueStatus
      ariaLabel="1 file uploading"
      dashboard={testDashboard()}
      placement="bottom"
    >
      1
    </MutationQueueStatus>
  )

  fireEvent.click(view.getByRole('button', {name: '1 file uploading'}))

  await view.findByText('Sync status')
  view.getByText('photo.png')
  view.getByText('Uploading file 50%')
  cleanup()
})
