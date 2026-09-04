import {suite} from '@alinea/suite'
import {mapConcurrent} from './Async.js'

const test = suite(import.meta)

test('maps with bounded concurrency and completion-order streaming', async () => {
  const started: Array<number> = []
  const releases: Array<() => void> = []
  let active = 0
  let maxActive = 0

  const iterator = mapConcurrent(
    [0, 1, 2, 3],
    value =>
      new Promise<number>(resolve => {
        started.push(value)
        active++
        maxActive = Math.max(maxActive, active)
        releases[value] = () => {
          active--
          resolve(value)
        }
      }),
    {concurrency: 2}
  )

  const first = iterator.next()
  await Promise.resolve()
  test.equal(started, [0, 1])

  releases[1]()
  test.is((await first).value, 1)
  test.equal(started, [0, 1, 2])

  releases[0]()
  releases[2]()
  await Promise.resolve()
  test.equal(started, [0, 1, 2])

  test.is((await iterator.next()).value, 0)
  test.equal(started, [0, 1, 2, 3])
  test.is((await iterator.next()).value, 2)

  releases[3]()
  test.is((await iterator.next()).value, 3)
  test.is((await iterator.next()).done, true)
  test.is(maxActive, 2)
})

test('aborts without waiting for pending work', async () => {
  const controller = new AbortController()
  const iterator = mapConcurrent([0], () => new Promise<number>(() => {}), {
    concurrency: 1,
    signal: controller.signal
  })
  const next = iterator.next()
  await Promise.resolve()

  const error = new Error('Cancelled')
  controller.abort(error)

  await test.throws(() => next, 'Cancelled')
})
