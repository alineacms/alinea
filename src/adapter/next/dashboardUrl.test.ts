import {Config} from '#/core/Config.js'
import {test} from 'bun:test'
import {expect} from 'bun:test'
import {dashboardUrl} from './dashboardUrl.js'

const handler = 'https://site.example/api/cms'

function config(options: Partial<Config>): Config {
  return {schema: {}, workspaces: {}, ...options} as Config
}

test('links to the generated dashboard file in production', () => {
  expect(dashboardUrl(config({}), false, handler)).toBe(
    'https://site.example/admin.html'
  )
  expect(dashboardUrl(config({adminPath: '/cms/admin'}), false, handler)).toBe(
    'https://site.example/cms/admin.html'
  )
  expect(
    dashboardUrl(config({dashboardFile: 'cms/index.html'}), false, handler)
  ).toBe('https://site.example/cms/index.html')
})

test('links to the admin path in development', () => {
  expect(dashboardUrl(config({}), true, handler)).toBe('/admin')
  expect(dashboardUrl(config({adminPath: 'cms'}), true, handler)).toBe('/cms')
})
