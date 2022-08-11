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
import {Logger} from '@alinea/core/util/Logger'
import {Expr, Store} from '@alinea/store'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import * as Y from 'yjs'
import {Data} from './Data'
import {appendPath} from './util/EntryPaths'

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
    entries: Array<{id: string; alinea: {index: string | null}}>,
    from: number
  ) {
    while (from++ < entries.length - 1) {
      const entry = entries[from]
      if (entry.alinea.index) return entry.alinea.index
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
          alinea: Entry.alinea
        })
          .where(condition)
          .orderBy(Entry.alinea.index.asc())
      )
      .map(entry => {
        const isValid =
          isValidOrderKey(entry.alinea.index) && !seen.has(entry.alinea.index)
        seen.add(entry.alinea.index)
        return isValid ? entry : {...entry, index: null}
      })
    let prev: string | null = null
    entries.forEach((entry, i) => {
      if (!entry.alinea.index) {
        const next = nextValidIndex(entries, i)
        entry.alinea.index = generateKeyBetween(prev, next)
        store.update(Entry.where(Entry.id.is(entry.id)), {
          alinea: {...entry.alinea, index: entry.alinea.index}
        })
      }
      seen.add(entry.alinea.index)
      prev = entry.alinea.index
      if (includeChildren && entry.alinea.isContainer)
        validateOrdersFor(store, Entry.alinea.parent.is(entry.id))
    })
  }

  function validateOrder(store: Store, only?: Array<string>) {
    if (only) {
      const entries = store.all(
        Entry.where(Entry.id.isIn([...new Set(only)])).select({
          parent: Entry.alinea.parent,
          workspace: Entry.alinea.workspace,
          root: Entry.alinea.root
        })
      )
      for (const entry of entries) {
        if (entry.parent)
          validateOrdersFor(store, Entry.alinea.parent.is(entry.parent), false)
        else
          validateOrdersFor(
            store,
            Entry.alinea.workspace
              .is(entry.workspace)
              .and(Entry.alinea.root.is(entry.root))
              .and(Entry.alinea.parent.isNull()),
            false
          )
      }
    } else {
      const roots = store.all(
        Entry.select({
          workspace: Entry.alinea.workspace,
          root: Entry.alinea.root
        })
          .where(Entry.alinea.parent.isNull())
          .groupBy(Entry.alinea.workspace, Entry.alinea.root)
      )
      for (const root of roots) {
        validateOrdersFor(
          store,
          Entry.alinea.workspace
            .is(root.workspace)
            .and(Entry.alinea.root.is(root.root))
            .and(Entry.alinea.parent.isNull())
        )
      }
    }
  }

  const indexing = new WeakMap()

  export async function create(
    store: SqliteStore,
    config: Config,
    from: Data.Source,
    logger: Logger = new Logger('Create cache')
  ) {
    if (indexing.has(store)) throw 'Already indexing'
    indexing.set(store, true)
    const endDbSetup = logger.time('Database setup')
    let total = 0
    const batch: Array<Entry> = []
    function commitBatch(logger: Logger) {
      store.transaction(() => {
        const inserted = store.insertAll(Entry, batch)

        for (const entry of inserted) indexSearch(store, entry, false)
      })
      batch.length = 0
    }
    store.delete(Entry)
    store.createFts5Table(Search, 'Search', () => {
      return {title: Search.title}
    })
    endDbSetup()
    const endScan = logger.time('Scanning entries')
    for await (const entry of from.entries()) {
      total++
      if (total % 1000 === 0) {
        logger.progress(`Scanned ${total} entries`)
        commitBatch(logger)
      }
      batch.push(entry)
    }
    commitBatch(logger)
    endScan()
    const endIndex = logger.time('Indexing entries')
    store.createIndex(Entry, 'index', [Entry.alinea.index])
    store.createIndex(Entry, 'i18nId', [Entry.alinea.i18n.id])
    store.createIndex(Entry, 'parent', [Entry.alinea.parent])
    store.createIndex(Entry, 'workspace.root.type', [
      Entry.workspace,
      Entry.root,
      Entry.type
    ])
    store.createIndex(Entry, 'root', [Entry.alinea.root])
    store.createIndex(Entry, 'type', [Entry.type])
    store.createIndex(Entry, 'url', [Entry.url])
    endIndex()
    const endValidate = logger.time('Validating orders')
    for (const [workspace, {schema}] of Object.entries(config.workspaces)) {
      for (const [key, type] of schema) {
        const {index} = type.options
        if (!index) continue
        const collection = type.collection()
        const indices = index(collection)
        for (const [name, fields] of Object.entries(indices)) {
          const indexName = `${workspace}.${key}.${name}`
          store.createIndex(collection, indexName, fields)
        }
      }
    }
    validateOrder(store)
    endValidate()
    logger.summary(`Indexed ${total} entries`)
    indexing.delete(store)
  }

  export function computeEntry(
    store: Store,
    config: Config,
    entry: Entry,
    status: EntryStatus = EntryStatus.Published
  ): Entry {
    const type = config.type(entry.alinea.workspace, entry.type)
    if (!type) throw createError(400, 'Type not found')
    const root = config.root(entry.alinea.workspace, entry.alinea.root)
    const parents: Array<string> = []
    let target = entry.alinea.parent,
      url = entry.path === 'index' ? '' : entry.path
    while (target) {
      if (parents.includes(target))
        throw createError(400, 'Circular parent reference')
      parents.unshift(target)
      const parent = store.first(
        Entry.where(Entry.id.is(target)).select({
          parent: Entry.alinea.parent,
          path: Entry.path
        })
      )
      if (!parent) break
      url = (parent.path === 'index' ? '' : parent.path) + '/' + url
      target = parent.parent
    }
    if (root.i18n) {
      const locale = entry.alinea.i18n?.locale!
      if (!root.i18n.locales.includes(locale))
        throw createError(
          400,
          `Invalid locale "${locale}" in entry with url "${entry.url}"`
        )
      url = `${locale}/${url}`
      const i18nParents =
        parents.length > 0
          ? store.all(
              Entry.where(Entry.id.isIn(parents)).select(
                Entry.alinea.i18n.id.sure()
              )
            )
          : parents
      entry.alinea.i18n = {
        id: entry.alinea.i18n!.id,
        locale,
        parent: i18nParents[i18nParents.length - 1],
        parents: i18nParents
      }
    } else {
      delete entry.alinea.i18n
    }
    return {
      ...entry,
      url: '/' + url,
      alinea: {
        ...entry.alinea,
        parent: parents[parents.length - 1],
        parents: parents,
        isContainer: type!.options.isContainer,
        status
      }
    }
  }

  function setChildrenUrl(store: Store, parentUrl: string, parentId: string) {
    const children = store.all(Entry.where(Entry.alinea.parent.is(parentId)))
    for (const child of children) {
      const url = appendPath(parentUrl, child.path)
      store.update(Entry.where(Entry.id.is(child.id)), {
        'alinea.url': url
      } as any)
      setChildrenUrl(store, url, child.id)
    }
  }

  export function applyUpdates(
    store: Store,
    config: Config,
    updates: Array<readonly [string, Uint8Array]>
  ) {
    const changed = []
    for (const [id, update] of updates) {
      const condition = Entry.where(Entry.id.is(id))
      const existing = store.first(condition)
      const [entry, err] = outcome(() => {
        const doc = new Y.Doc()
        Y.applyUpdate(doc, update)
        const data = entryFromDoc(doc, config.type)
        return {
          ...computeEntry(store, config, data!, EntryStatus.Draft)
        }
      })
      if (!entry) {
        console.error(err)
        console.log(
          `Could not parse update for entry with id "${id}"\n  > ${err}`
        )
        continue
      }
      changed.push(id)
      if (existing) {
        if (existing.url !== entry.url)
          setChildrenUrl(store, entry.url, entry.id)
        store.update(condition, entry)
      } else {
        store.insert(Entry, entry)
      }
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
        if (existing) {
          if (existing.url !== entry.url)
            setChildrenUrl(store, entry.url, entry.id)
          store.update(condition, entry)
        } else {
          store.insert(Entry, entry)
        }
        indexSearch(store, entry)
      }
    })
  }
}
