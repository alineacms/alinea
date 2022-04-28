import {
  Config,
  createError,
  Entry,
  entryFromDoc,
  EntryStatus,
  outcome
} from '@alinea/core'
import {Search} from '@alinea/core/Search'
import {
  generateKeyBetween,
  isValidOrderKey
} from '@alinea/core/util/FractionalIndexing'
import {Expr, Store} from '@alinea/store'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import convertHrtime from 'convert-hrtime'
import prettyMilliseconds from 'pretty-ms'
import * as Y from 'yjs'
import {Data} from './Data'

export namespace Cache {
  function indexSearch(store: Store, entry: Entry, lookup = true) {
    // Todo: unroll languages
    const row = {id: entry.id, title: String(entry.title)}
    const condition = Search.where(Search.id.is(entry.id))
    const existing = lookup && store.first(condition)
    if (existing) store.update(condition, row)
    else store.insert(Search, row)
  }

  function nextValidIndex(
    entries: Array<{id: string; index: string | null}>,
    from: number
  ) {
    while (from++ < entries.length - 1) {
      const entry = entries[from]
      if (entry.index) return entry.index
    }
    return null
  }

  function validateOrdersFor(
    store: Store,
    condition: Expr<boolean>,
    includeChildren = true
  ) {
    const seen = new Set()
    const entries = store
      .all(
        Entry.select({
          id: Entry.id,
          index: Entry.index,
          $isContainer: Entry.$isContainer
        })
          .where(condition)
          .orderBy(Entry.index.asc())
      )
      .map(entry => {
        const isValid = isValidOrderKey(entry.index) && !seen.has(entry.index)
        seen.add(entry.index)
        return isValid ? entry : {...entry, index: null}
      })
    let prev: string | null = null
    entries.forEach((entry, i) => {
      if (!entry.index) {
        const next = nextValidIndex(entries, i)
        entry.index = generateKeyBetween(prev, next)
        store.update(Entry.where(Entry.id.is(entry.id)), {index: entry.index})
      }
      seen.add(entry.index)
      prev = entry.index
      if (includeChildren && entry.$isContainer)
        validateOrdersFor(store, Entry.parent.is(entry.id))
    })
  }

  function validateOrder(store: Store, only?: Array<string>) {
    if (only) {
      const entries = store.all(
        Entry.where(Entry.id.isIn([...new Set(only)])).select({
          parent: Entry.parent,
          workspace: Entry.workspace,
          root: Entry.root
        })
      )
      for (const entry of entries) {
        if (entry.parent)
          validateOrdersFor(store, Entry.parent.is(entry.parent), false)
        else
          validateOrdersFor(
            store,
            Entry.workspace
              .is(entry.workspace)
              .and(Entry.root.is(entry.root))
              .and(Entry.parent.isNull()),
            false
          )
      }
    } else {
      const roots = store.all(
        Entry.select({
          workspace: Entry.workspace,
          root: Entry.root
        })
          .where(Entry.parent.isNull())
          .groupBy(Entry.workspace, Entry.root)
      )
      for (const root of roots) {
        validateOrdersFor(
          store,
          Entry.workspace
            .is(root.workspace)
            .and(Entry.root.is(root.root))
            .and(Entry.parent.isNull())
        )
      }
    }
  }

  export async function create(
    store: SqliteStore,
    config: Config,
    from: Data.Source,
    log = false
  ) {
    const startTime = process.hrtime.bigint()
    if (log) process.stdout.write('> Start indexing...\r')
    store.delete(Entry)
    store.createFts5Table(Search, 'Search', () => {
      return {title: Search.title}
    })
    let total = 0
    const batch: Array<Entry> = []
    function commitBatch() {
      store.transaction(() => {
        for (const entry of batch) {
          store.insert(Entry, entry)
          indexSearch(store, entry, false)
        }
      })
      batch.length = 0
    }
    for await (const entry of from.entries()) {
      total++
      if (log && total % 1000 === 0) {
        process.stdout.write(`> Scanned ${total} entries\r`)
        commitBatch()
      }
      batch.push(entry)
    }
    commitBatch()
    if (log) process.stdout.write(`> Indexing...\r`)
    store.createIndex(Entry, 'index', [Entry.index])
    store.createIndex(Entry, 'parent', [Entry.parent])
    store.createIndex(Entry, 'workspace.root.type', [
      Entry.workspace,
      Entry.root,
      Entry.type
    ])
    store.createIndex(Entry, 'root', [Entry.root])
    store.createIndex(Entry, 'type', [Entry.type])
    store.createIndex(Entry, 'url', [Entry.url])
    if (log) process.stdout.write(`> Validating order...\r`)
    for (const [workspace, {schema}] of Object.entries(config.workspaces)) {
      for (const [key, type] of schema) {
        const {index} = type.options
        if (!index) continue
        const collection = schema.collection(workspace, key)
        const indices = index(collection)
        for (const [name, fields] of Object.entries(indices)) {
          const indexName = `${workspace}.${key}.${name}`
          store.createIndex(collection, indexName, fields)
        }
      }
    }
    validateOrder(store)
    const diff = process.hrtime.bigint() - startTime
    if (log)
      console.log(
        `> Indexed ${total} entries in ${prettyMilliseconds(
          convertHrtime(diff).milliseconds
        )}`
      )
  }

  export function computeEntry(store: Store, config: Config, entry: Entry) {
    const type = config.type(entry.workspace, entry.type)
    if (!type) throw createError(400, 'Type not found')
    const root = config.root(entry.workspace, entry.root)
    const parents: Array<string> = []
    let target = entry.parent,
      url = entry.path
    while (target) {
      if (parents.includes(target))
        throw createError(400, 'Circular parent reference')
      parents.unshift(target)
      const parent = store.first(
        Entry.where(Entry.id.is(target)).select({
          parent: Entry.parent,
          path: Entry.path
        })
      )
      if (!parent) break
      url = (parent.path === 'index' ? '' : parent.path) + '/' + url
      target = parent.parent
    }
    if (root.i18n) {
      if (!root.i18n.locales.includes(entry.locale!))
        throw createError(
          400,
          `Invalid locale "${entry.locale}" in entry with url "${entry.url}"`
        )
      url = `${entry.locale}/${url}`
    }
    return {
      ...entry,
      url: '/' + url,
      parent: parents[parents.length - 1],
      parents: parents,
      $isContainer: type!.options.isContainer
    }
  }

  export function applyUpdates(
    store: Store,
    config: Config,
    updates: IterableIterator<[string, Uint8Array]>
  ) {
    const changed = []
    for (const [id, update] of updates) {
      const condition = Entry.where(Entry.id.is(id))
      const existing = store.first(condition)
      const doc = new Y.Doc()
      // if (existing) docFromEntry(config, existing, doc)
      Y.applyUpdate(doc, update)
      const [entry, err] = outcome(() => {
        const data = entryFromDoc(doc, config.type)
        return {
          ...computeEntry(store, config, data!),
          $status: EntryStatus.Draft
        }
      })
      if (!entry) {
        console.log(
          `Could not parse update for entry with id "${id}"\n  > ${err}`
        )
        continue
      }
      changed.push(id)
      if (existing) store.update(condition, entry)
      else store.insert(Entry, entry)
      indexSearch(store, entry)
    }
    validateOrder(store, changed)
  }

  export function applyPublish(
    store: Store,
    config: Config,
    entries: Array<Entry>
  ) {
    return store.transaction(() => {
      for (const data of entries) {
        const entry = computeEntry(store, config, data)
        const condition = Entry.where(Entry.id.is(entry.id))
        const existing = store.first(condition)
        if (existing) store.update(condition, entry)
        else store.insert(Entry, entry)
        indexSearch(store, entry)
      }
    })
  }
}
