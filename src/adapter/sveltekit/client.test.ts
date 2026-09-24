import '#test/react.js'
import type {PreviewRefreshDetail} from '#/preview/client.js'
import {expect, mock, test} from 'bun:test'
import {refreshPreviews} from './client.js'

function dispatchRefresh() {
  let done = () => {}
  const refreshed = new Promise<void>(resolve => (done = resolve))
  const event = new CustomEvent<PreviewRefreshDetail>('alinea:refresh', {
    cancelable: true,
    detail: {done}
  })
  const reloads = window.dispatchEvent(event)
  return {refreshed, reloads}
}

test('preview updates rerun the load functions instead of reloading', async () => {
  const invalidateAll = mock(async () => {})
  const stop = refreshPreviews(invalidateAll)

  const {refreshed, reloads} = dispatchRefresh()
  expect(reloads).toBe(false)
  expect(invalidateAll).toHaveBeenCalledTimes(1)
  await refreshed

  stop()
  expect(dispatchRefresh().reloads).toBe(true)
  expect(invalidateAll).toHaveBeenCalledTimes(1)
})
