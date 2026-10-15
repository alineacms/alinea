import {expect, test} from 'bun:test'
import {describeSync, syncStats} from './SyncStats.js'

const from = '1a2b3c4d5e6f'
const to = '5d6e7f8a9b0c'

test('describes a sync by its steps in order', () => {
  const stats = {steps: {derive: 600.4, tree: 120}, files: 1, versions: 291}
  expect(describeSync('interval', from, to, 3962.2, stats)).toBe(
    'Alinea synced 1a2b3c4 → 5d6e7f8 (interval) in 3962 ms: tree 120 ms, ' +
      'derive 600 ms, 1 file, 291 versions derived'
  )
})

test('describes a sync that found nothing new', () => {
  const stats = {...syncStats(), steps: {tree: 80}}
  expect(describeSync('sha', to, to, 81, stats)).toBe(
    'Alinea is current at 5d6e7f8 (sha) in 81 ms: tree 80 ms'
  )
})

test('describes a sync that failed', () => {
  const stats = {...syncStats(), steps: {tree: 10002}}
  expect(describeSync('interval', from, undefined, 10003, stats)).toBe(
    'Alinea failed to sync from 1a2b3c4 (interval) in 10003 ms: tree 10002 ms, 0 files, 0 versions derived'
  )
})
