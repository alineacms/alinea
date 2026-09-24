import type {Config} from '#/core/Config.js'
import {Entry} from '#/core/Entry.js'
import type {GraphQuery} from '#/core/Graph.js'
import {Config as ConfigBuilder, Field, Query} from '#/index.js'
import {createEntrySource, type EntryFixtureEntry} from '#test/EntryFixture.js'
import {expect, test} from 'bun:test'
import {Database} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {wasmDatabase} from '../driver/WasmDatabase.js'
import {EntryDatabase} from '../EntryDatabase.js'
import type {EntryLayer} from '../EntryLayer.js'

// Site navigation: many menu links, each reading its target's surroundings.
const menus = Array.from({length: 8}, (_, i) => Field.entry(`Menu ${i}`))
const Page = ConfigBuilder.document('Page', {
  fields: {
    link: Field.entry('Link'),
    related: Field.entry.multiple('Related'),
    ...Object.fromEntries(menus.map((field, i) => [`menu${i}`, field]))
  }
})
const config: Config = {
  schema: {Page},
  workspaces: {
    main: ConfigBuilder.workspace('Main', {
      source: 'content',
      roots: {
        pages: ConfigBuilder.root('Pages', {
          contains: ['Page'],
          i18n: {locales: ['en', 'de']}
        })
      }
    })
  }
}

interface PageInput {
  id: string
  index: string
  parents?: Array<string>
  data?: Record<string, unknown>
}

function source(inputs: Array<PageInput>) {
  const entries = inputs.flatMap(({id, index, parents, data}) =>
    ['en', 'de'].map(
      (locale): EntryFixtureEntry => ({
        id,
        type: 'Page',
        index,
        locale,
        parentPaths: parents,
        data: {path: id, title: `${id} ${locale}`, ...data}
      })
    )
  )
  return createEntrySource(config, entries)
}

const link = (id: string) => ({_type: 'entry', _id: `l-${id}`, _entry: id})
const aliases = (url: string) => ({metadata: {aliases: [{url}]}})

const menuTargets = [
  ...['home', 'about', 'team', 'alice'],
  ...['bob', 'history', 'blog', 'team']
]
const base: Array<PageInput> = [
  {
    id: 'home',
    index: 'a0',
    data: {
      link: link('team'),
      related: [link('bob')],
      ...Object.fromEntries(
        menus.map((_, i) => [`menu${i}`, link(menuTargets[i])])
      )
    }
  },
  {id: 'about', index: 'a0', parents: ['home'], data: aliases('/about')},
  {id: 'team', index: 'a0', parents: ['home', 'about']},
  {id: 'alice', index: 'a0', parents: ['home', 'about', 'team']},
  {id: 'bob', index: 'a1', parents: ['home', 'about', 'team']},
  {id: 'history', index: 'a1', parents: ['home', 'about']},
  {id: 'blog', index: 'a1', parents: ['home']}
]
// Edits, additions and deletions, so relations cross base and change rows.
const diverged: Array<PageInput> = [
  ...base.filter(page => page.id !== 'history' && page.id !== 'about'),
  {id: 'about', index: 'a0', parents: ['home'], data: aliases('/about-us')},
  {id: 'carol', index: 'a2', parents: ['home', 'about', 'team']},
  {id: 'faq', index: 'a2', parents: ['home', 'about']}
]
const nested: Array<PageInput> = [
  ...diverged.filter(page => page.id !== 'bob'),
  {id: 'dave', index: 'a0', parents: ['home', 'about', 'team', 'alice']}
]

function team(select: GraphQuery['select']): GraphQuery {
  return {first: true, id: 'team', locale: 'en', select}
}

const queries: Record<string, GraphQuery> = {
  children: team(Query.children({select: Entry.id})),
  descendants: team(Query.children({depth: 2, select: Entry.id})),
  parent: team(Query.parent({select: Entry.id})),
  parents: team(Query.parents({select: Entry.id})),
  siblings: team(Query.siblings({select: Entry.id})),
  next: team({
    next: Query.next({select: Entry.id}),
    previous: Query.previous({select: Entry.id})
  }),
  translations: team(Query.translations({select: Entry.locale})),
  link: {
    first: true,
    id: 'home',
    locale: 'de',
    select: {link: Page.link, related: Page.related.find({select: Entry.id})}
  },
  count: {count: true, parentId: 'about', locale: 'en'},
  search: {search: 'team', locale: 'en', select: Entry.id},
  groupBy: {
    location: ['main', 'pages'],
    groupBy: Entry.parentId,
    select: Entry.id
  },
  alias: {alias: {in: ['/about', '/about-us']}, select: Entry.id},
  navigation: {
    first: true,
    id: 'home',
    locale: 'en',
    type: Page,
    select: Object.fromEntries(
      menus.map((field, i) => [
        `menu${i}`,
        field.first({
          select: {
            id: Entry.id,
            parent: Query.parent({select: {id: Entry.id, url: Entry.url}}),
            children: Query.children({
              select: {
                title: Entry.title,
                children: Query.children({select: Entry.id})
              }
            })
          }
        })
      ])
    )
  }
}
/** Alias conditions scan the entries, reading each version's aliases. */
const scanning = new Set(['alias'])

interface PlanRow {
  id: number
  parent: number
  detail: string
}

/**
 * Plan steps that read an entry table without an index, or build one on the
 * fly. Derived tables (co-routines, materialized subqueries and CTEs),
 * json_each and FTS tables are not entry tables. A top-level list may walk an
 * index in order, but a correlated read (once per outer row) must search.
 */
function planProblems(plan: Array<PlanRow>): Array<string> {
  const rows = new Map(plan.map(row => [row.id, row]))
  const derived = new Set(
    plan.flatMap(row => {
      const match = /^(?:CO-ROUTINE|MATERIALIZE) (\S+)/.exec(row.detail)
      return match ? [match[1]] : []
    })
  )
  function correlated(row: PlanRow): boolean {
    for (let at = rows.get(row.parent); at; at = rows.get(at.parent))
      if (at.detail.startsWith('CORRELATED')) return true
    return false
  }
  return plan
    .filter(row => {
      const read = /^(SCAN|SEARCH) (\S+)/.exec(row.detail)
      if (!read || derived.has(read[2]!)) return false
      if (/VIRTUAL TABLE|CONSTANT ROW/.test(row.detail)) return false
      if (row.detail.includes('AUTOMATIC')) return true
      if (read[1] === 'SEARCH') return false
      return !/USING (COVERING )?INDEX/.test(row.detail) || correlated(row)
    })
    .map(row => row.detail)
}

/** Resolve every query and the references to one entry. */
async function resolveAll(layer: EntryLayer, onQuery = (_: string) => {}) {
  const results: Record<string, unknown> = {}
  for (const [name, query] of Object.entries(queries)) {
    onQuery(name)
    results[name] = await layer.resolve(query)
  }
  onQuery('references')
  results.references = await layer.referencesTo({targetId: 'team'})
  return results
}

function recordingDatabase() {
  const sqlite = new Database(':memory:')
  const log = {reads: Array<string>()}
  const executing = new Set<string | symbol>(['all', 'get', 'run', 'values'])
  // Record when statements run: rado reuses prepared statements.
  function recordRuns<T extends object>(statement: T, query: string): T {
    return new Proxy(statement, {
      get(target, key) {
        const value = Reflect.get(target, key)
        if (typeof value !== 'function') return value
        if (!executing.has(key)) return value.bind(target)
        return (...args: Array<unknown>) => {
          log.reads.push(query)
          return value.apply(target, args)
        }
      }
    })
  }
  const recording = new Proxy(sqlite, {
    get(target, key) {
      if (key === 'prepare')
        return (query: string) => {
          const statement = target.prepare(query)
          return /alinea_entry_index|alinea_overlay_\d+_entries/.test(query)
            ? recordRuns(statement, query)
            : statement
        }
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
  return {sqlite, log, db: connect(recording)}
}

async function plainDatabase(inputs: Array<PageInput>) {
  // The plain database stores JSONB, the overlaid one text.
  const db = await wasmDatabase()
  await EntryDatabase.createSchema(db, 'empty')
  const database = new EntryDatabase(config, db)
  await database.syncWith(await source(inputs))
  return database
}

test('overlay queries read indexed tables and answer as a plain database', async () => {
  const {sqlite, log, db} = recordingDatabase()
  await EntryDatabase.createSchema(db, 'empty')
  const database = new EntryDatabase(config, db)
  await database.syncWith(await source(base))

  /** Resolve through a layer, recording the entry reads of every query. */
  async function recorded(layer: EntryLayer) {
    const reads: Record<string, Array<string>> = {}
    const results = await resolveAll(layer, name => {
      log.reads = reads[name] = []
    })
    return {reads, results}
  }

  /** Check the plan of every entry read. */
  function checkPlans(reads: Record<string, Array<string>>) {
    for (const [name, statements] of Object.entries(reads)) {
      expect({name, reads: statements.length > 0}).toEqual({name, reads: true})
      if (scanning.has(name)) continue
      for (const statement of statements) {
        const explain = sqlite.prepare(`explain query plan ${statement}`)
        const plan = explain.all() as Array<PlanRow>
        explain.finalize()
        expect({name, problems: planProblems(plan)}).toEqual({
          name,
          problems: []
        })
      }
    }
  }

  // Unwritten overlays, nested ones too, run the base database's statements.
  // Written ones read a copy of their parent, with the same indexes.
  const plain = await recorded(database)
  checkPlans(plain.reads)
  const empty = await database.overlay(await source(base))
  const emptier = await empty.overlay(await source(base))
  for (const layer of [empty, emptier]) {
    const run = await recorded(layer)
    expect(run.reads).toEqual(plain.reads)
    expect(run.results).toEqual(plain.results)
  }
  await emptier.close()

  const changed = await database.overlay(await source(diverged))
  const preview = await changed.overlay(await source(nested))
  for (const [inputs, layer] of [
    [diverged, changed],
    [nested, preview]
  ] as const) {
    const {reads, results} = await recorded(layer)
    checkPlans(reads)
    const plain = await plainDatabase(inputs)
    expect(results).toEqual(await resolveAll(plain))
    await plain.close()
  }

  await preview.close()
  await changed.close()
  await empty.close()
  await database.close()
})

test('an empty createOverlay() shows an apply() edit afterwards', async () => {
  const database = await plainDatabase(base)
  const overlay = await database.createOverlay()
  const title = {
    first: true,
    id: 'team',
    locale: 'en',
    select: Entry.title
  } as const
  await overlay.database.apply(
    [
      {
        op: 'update',
        id: 'team',
        locale: 'en',
        status: 'published',
        set: {title: 'Crew'}
      }
    ],
    {source: overlay.source}
  )
  expect(await overlay.database.resolve(title)).toBe('Crew')
  expect(await database.resolve(title)).toBe('team en')
  await overlay.close()
  await database.close()
})
