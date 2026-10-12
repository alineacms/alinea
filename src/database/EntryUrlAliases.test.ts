import {MediaFile} from '#/core/media/MediaTypes.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'
import {dataWithUrlAliases, hasUrlAliases} from './EntryUrlAliases.js'

const test = suite(import.meta)

function urls(data: Record<string, unknown>) {
  const metadata = data.metadata as {aliases: Array<{url: string}>}
  return metadata.aliases.map(alias => alias.url)
}

test('pages keep url aliases in their metadata', () => {
  const Page = Config.document('Page', {fields: {}})
  const Plain = Config.type('Plain', {fields: {title: Field.text('Title')}})
  test.is(hasUrlAliases(Page), true)
  test.is(hasUrlAliases(Plain), false)
  test.is(hasUrlAliases(MediaFile), true)
})

test('adds the urls that are not an alias yet, after the others', () => {
  const data = dataWithUrlAliases({title: 'Page'}, ['/one', '/two', '/one'])
  test.equal(urls(data), ['/one', '/two'])
  const next = dataWithUrlAliases(data, ['/two', '/three'])
  test.equal(urls(next), ['/one', '/two', '/three'])
  const {aliases} = next.metadata as {aliases: Array<{_index: string}>}
  const [one, two, three] = aliases
  test.ok(one._index < two._index && two._index < three._index)
  test.is(dataWithUrlAliases(next, ['/one', '']), next)
})
