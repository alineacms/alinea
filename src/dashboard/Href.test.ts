import {suite} from '@alinea/suite'
import {href} from '#/dashboard/Href.js'

const test = suite(import.meta)

test('links entries by id or by location', () => {
  test.is(href({entryId: 'about'}), '#/edit?id=about')
  test.is(
    href({entryId: 'about', locale: 'en', view: 'edit'}),
    '#/edit?id=about&locale=en&view=edit'
  )
  test.is(
    href({workspace: 'main', root: 'pages', entryId: 'about', locale: 'en'}),
    '#/entry/main/pages:en/about'
  )
  test.is(href({workspace: 'main', root: 'pages'}), '#/entry/main/pages')
})
