import {expect, mock, test} from 'bun:test'
import {syncIfStale} from './syncCheck.js'

function dbWith(sha: string) {
  const syncWith = mock(async () => sha)
  const db = {sha, syncWith}
  return {db, syncWith}
}

function latestShaOf(sha: string | undefined) {
  return mock(async () => sha)
}

test('returns false when the latest sha cannot be determined', async () => {
  const {db, syncWith} = dbWith('local')
  const settled = await syncIfStale(db, latestShaOf(undefined), 60)
  expect(settled).toBe(false)
  expect(syncWith).not.toHaveBeenCalled()
})

test('forces sync when syncInterval is 0 without fetching the tree', async () => {
  const {db, syncWith} = dbWith('local')
  const latestSha = latestShaOf('other')
  const settled = await syncIfStale(db, latestSha, 0)
  expect(settled).toBe(true)
  expect(syncWith).toHaveBeenCalledTimes(1)
  expect(latestSha).not.toHaveBeenCalled()
})

test('skips everything when sync is disabled', async () => {
  const {db, syncWith} = dbWith('local')
  const latestSha = latestShaOf('other')
  const settled = await syncIfStale(db, latestSha, Number.POSITIVE_INFINITY)
  expect(settled).toBe(true)
  expect(syncWith).not.toHaveBeenCalled()
  expect(latestSha).not.toHaveBeenCalled()
})

test('syncs once when the isolate db is behind the shared sha', async () => {
  const {db, syncWith} = dbWith('stale-sha')
  const settled = await syncIfStale(db, latestShaOf('fresh-sha'), 3600)
  expect(settled).toBe(true)
  expect(syncWith).toHaveBeenCalledTimes(1)
})

test('skips sync when the isolate db matches the shared sha', async () => {
  const {db, syncWith} = dbWith('fresh-sha')
  const settled = await syncIfStale(db, latestShaOf('fresh-sha'), 3600)
  expect(settled).toBe(true)
  expect(syncWith).not.toHaveBeenCalled()
})
