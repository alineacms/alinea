import type {Client} from '#/core/Client.js'
import {expect, mock, test} from 'bun:test'
import {syncIfStale} from './syncCheck.js'

function dbWith(sha: string) {
  const syncWith = mock(async () => sha)
  const db = {sha, syncWith}
  return {db, syncWith}
}

function clientWith(sha: string | undefined) {
  const getSha = mock(async () => {
    if (sha === undefined) throw new Error('unreachable')
    return sha
  })
  return {client: {getSha} as unknown as Client, getSha}
}

test('returns false when the latest sha cannot be determined', async () => {
  const {db, syncWith} = dbWith('local')
  const {client} = clientWith(undefined)
  const settled = await syncIfStale(db, client, 60)
  expect(settled).toBe(false)
  expect(syncWith).not.toHaveBeenCalled()
})

test('forces sync when syncInterval is 0 without fetching the sha', async () => {
  const {db, syncWith} = dbWith('local')
  const {client, getSha} = clientWith('other')
  const settled = await syncIfStale(db, client, 0)
  expect(settled).toBe(true)
  expect(syncWith).toHaveBeenCalledTimes(1)
  expect(getSha).not.toHaveBeenCalled()
})

test('skips everything when sync is disabled', async () => {
  const {db, syncWith} = dbWith('local')
  const {client, getSha} = clientWith('other')
  const settled = await syncIfStale(db, client, Number.POSITIVE_INFINITY)
  expect(settled).toBe(true)
  expect(syncWith).not.toHaveBeenCalled()
  expect(getSha).not.toHaveBeenCalled()
})

test('syncs once when the isolate db is behind the shared sha', async () => {
  const {db, syncWith} = dbWith('stale-sha')
  const {client} = clientWith('fresh-sha')
  const settled = await syncIfStale(db, client, 3600)
  expect(settled).toBe(true)
  expect(syncWith).toHaveBeenCalledTimes(1)
})

test('skips sync when the isolate db matches the shared sha', async () => {
  const {db, syncWith} = dbWith('fresh-sha')
  const {client} = clientWith('fresh-sha')
  const settled = await syncIfStale(db, client, 3600)
  expect(settled).toBe(true)
  expect(syncWith).not.toHaveBeenCalled()
})
