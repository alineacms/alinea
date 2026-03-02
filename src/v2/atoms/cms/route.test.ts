import {suite} from '@alinea/suite'
import {parseCmsPath} from './route.js'

const test = suite(import.meta)

test('parses locale from query string', () => {
  const route = parseCmsPath('/i18n/pages/home', '?locale=fr')
  test.equal(route, {
    workspace: 'i18n',
    root: 'pages',
    entry: 'home',
    locale: 'fr'
  })
})

test('handles routes without locale', () => {
  const route = parseCmsPath('/simple/pages')
  test.equal(route, {
    workspace: 'simple',
    root: 'pages',
    entry: undefined,
    locale: undefined
  })
})
