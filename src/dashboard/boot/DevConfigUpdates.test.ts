import {expect, test} from 'bun:test'
import {DevConfigUpdates} from './DevConfigUpdates.js'

function send(source: EventTarget, type: string, revision?: string) {
  source.dispatchEvent(
    new MessageEvent('message', {data: JSON.stringify({type, revision})})
  )
}

test('refreshes during imports/yields are retained and refetch cannot replace a newer requested configuration', async () => {
  const source = new EventTarget(),
    updates = new DevConfigUpdates(source, 'initial')
  try {
    send(source, 'refresh', 'second')
    send(source, 'refetch')
    expect(await updates.next()).toBe('second')
    // A second refresh arrives while the caller imports the previous config.
    send(source, 'refresh', 'third')
    send(source, 'refresh', 'fourth')
    send(source, 'refetch')
    expect(await updates.next()).toBe('fourth')
    const waiting = updates.next()
    source.dispatchEvent(new MessageEvent('message', {data: 'not json'}))
    send(source, 'unknown')
    send(source, 'refresh')
    send(source, 'refetch')
    expect(await waiting).toBe('fourth')
  } finally {
    updates.close()
  }
})

test('page reload remains immediate while worker reload advances its configuration', async () => {
  const source = new EventTarget()
  let reloads = 0
  const page = new DevConfigUpdates(source, 'initial', () => {
    reloads++
  })
  const worker = new DevConfigUpdates(source, 'initial')
  try {
    send(source, 'reload', 'next')
    expect(reloads).toBe(1)
    expect(await worker.next()).toBe('next')
    page.close()
    send(source, 'reload', 'last')
    expect(reloads).toBe(1)
    expect(await worker.next()).toBe('last')
    const waiting = worker.next().catch(error => error as Error)
    worker.close()
    expect(((await waiting) as Error).message).toContain('closed')
    await expect(worker.next()).rejects.toThrow('closed')
  } finally {
    page.close()
    worker.close()
  }
})
