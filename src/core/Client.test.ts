import {expect, test} from 'bun:test'
import {config} from '#test/sqlite-browser/config.js'
import {Client} from './Client.js'

test('Graph mutation transport honors caller cancellation', async () => {
  const started = Promise.withResolvers<AbortSignal>()
  const client = new Client({
    config,
    url: 'https://cms.test/api',
    fetch: Object.assign(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal
        if (!signal) throw new Error('Missing cancellation signal')
        started.resolve(signal)
        return new Promise<Response>((_resolve, reject) => {
          signal.throwIfAborted()
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true
          })
        })
      },
      {preconnect: fetch.preconnect}
    )
  })
  const abort = new AbortController()
  const result = client
    .mutate([], 'id', undefined, abort.signal)
    .catch(error => error)
  const signal = await started.promise
  abort.abort(new Error('Queue closed'))
  expect(signal.aborted).toBe(true)
  expect((await result).message).toContain('Queue closed')
})
