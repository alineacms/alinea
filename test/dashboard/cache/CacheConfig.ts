import type {Config} from '#/core/Config.js'
import {Config as ConfigBuilder, Field} from '#/index.js'
import type {EntryFixtureEntry} from '#test/EntryFixture.js'

export type CacheConfigName = 'a' | 'b' | 'c'

export const seeded = 300

// Each build searches another field: a word only found in that field tells
// whether the cache was derived for the build's own config.
const searchable: Record<CacheConfigName, 'none' | 'body' | 'summary'> = {
  a: 'none',
  b: 'body',
  c: 'summary'
}

export function cacheConfig(name: CacheConfigName): Config {
  const field = searchable[name]
  const Page = ConfigBuilder.document('Page', {
    fields: {
      title: Field.text('Title'),
      body: Field.text('Body', {searchable: field === 'body'}),
      summary: Field.text('Summary', {searchable: field === 'summary'})
    }
  })
  return {
    schema: {Page},
    workspaces: {
      main: ConfigBuilder.workspace('Main', {
        source: 'content',
        roots: {pages: ConfigBuilder.root('Pages', {contains: ['Page']})}
      })
    }
  }
}

const words = ['alpha', 'bravo', 'delta', 'echo', 'foxtrot', 'golf', 'hotel']

// A few KB of text per entry spreads the database over several 64 KB pages.
export function cacheEntries(): Array<EntryFixtureEntry> {
  return Array.from({length: seeded}, (_, i) => ({
    id: `p${i}`,
    type: 'Page',
    index: `a${String(i).padStart(4, '0')}`,
    data: {
      title: `Page ${i}`,
      body: Array.from(
        {length: 800},
        (_, j) => `${words[(i * 7 + j) % words.length]}${(i + j) % 97}`
      )
        .concat('needle')
        .join(' '),
      summary: `haystack ${i}`
    }
  }))
}
