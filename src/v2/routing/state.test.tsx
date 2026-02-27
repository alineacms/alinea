import {expect, test} from 'bun:test'
import {Config} from 'alinea'
import {parseRoute, routeToPath} from './state'

const config = Config.create({
  schema: {},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {
        pages: Config.root('Pages')
      }
    })
  }
})

test('parses entry route and formats back to path', () => {
  const route = parseRoute(config, '/entry/main/pages/entry-1')
  expect(route).toEqual({
    workspace: 'main',
    root: 'pages',
    entryId: 'entry-1'
  })
  expect(routeToPath(route)).toBe('/entry/main/pages/entry-1')
})

test('falls back to first route for unknown paths', () => {
  const route = parseRoute(config, '/unknown/path')
  expect(route).toEqual({
    workspace: 'main',
    root: 'pages'
  })
})
