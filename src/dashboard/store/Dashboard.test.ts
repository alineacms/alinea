import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {expect, test} from 'bun:test'
import {Dashboard} from './Dashboard.js'

function createDashboard() {
  const graph = {
    sync() {
      return Promise.resolve('sha')
    }
  } as unknown as WriteableGraph
  return new Dashboard(
    graph,
    {schema: {}, workspaces: {}},
    new EventTarget(),
    {} as LocalConnection,
    {}
  )
}

test('shares concurrent preview token requests for an origin', async () => {
  const dashboard = createDashboard()
  let requests = 0
  const client = {
    previewToken() {
      requests++
      return Promise.resolve('session-token')
    }
  } as unknown as LocalConnection

  const first = dashboard.previewSessionToken('https://example.com', client)
  const second = dashboard.previewSessionToken('https://example.com', client)

  expect(first).toBe(second)
  expect(await second).toBe('session-token')
  expect(requests).toBe(1)

  expect(
    await dashboard.previewSessionToken('https://example.com', client)
  ).toBe('session-token')
  expect(requests).toBe(2)
})
