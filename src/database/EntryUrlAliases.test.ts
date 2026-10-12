import {suite} from '@alinea/suite'
import {dataWithUrlAliases} from './EntryUrlAliases.js'

const test = suite(import.meta)

function urls(data: Record<string, unknown>) {
  const metadata = data.metadata as {aliases: Array<{url: string}>}
  return metadata.aliases.map(alias => alias.url)
}

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
