/**
 * Report what the stores of a realm do, without changing what they do: the
 * methods of the store classes are wrapped to trace their start and end.
 */
import {EntryDatabase} from '#/database/EntryDatabase.js'
import {EntryStore} from '#/database/EntryStore.js'
import {trace} from './realm.js'

const labels = new WeakMap<object, string>()
let resolves = 0

export function label(store: object, name: string) {
  labels.set(store, name)
}

export function labelOf(store: object): string {
  return labels.get(store) ?? 'store'
}

export function resolveCount() {
  return resolves
}

function short(sha: unknown) {
  return typeof sha === 'string' ? sha.slice(0, 7) : '?'
}

type Method = (...args: Array<any>) => Promise<any>

function wrap(
  proto: Record<string, any>,
  name: string,
  describe: (
    store: EntryStore,
    args: Array<any>,
    before: string,
    after: string,
    result: any
  ) => string | undefined
) {
  const original = proto[name] as Method
  proto[name] = async function (this: EntryStore, ...args: Array<any>) {
    const node = labelOf(this)
    const before = await this.sha
    const start = performance.now()
    try {
      const result = await original.apply(this, args)
      const after = await this.sha
      const text = describe(this, args, before, after, result)
      if (text)
        trace({
          node,
          kind: name,
          text,
          detail: {before, after, ms: Math.round(performance.now() - start)}
        })
      return result
    } catch (error) {
      trace({
        node,
        kind: 'error',
        text: `${name} failed: ${error instanceof Error ? error.message : error}`,
        detail: {before}
      })
      throw error
    }
  }
}

let installed = false

export function instrument() {
  if (installed) return
  installed = true
  const proto = EntryStore.prototype as unknown as Record<string, any>
  wrap(proto, 'syncWith', (_s, _a, before, after) =>
    before === after
      ? `sync: already at ${short(after)}`
      : `sync ${short(before)} → ${short(after)}`
  )
  wrap(proto, 'mutate', (_s, args, before, after) => {
    const ops = (args[0] as Array<{op: string}>).map(m => m.op).join(', ')
    return `apply ${ops} locally ${short(before)} → ${short(after)}`
  })
  wrap(
    proto,
    'request',
    (_s, _a, _b, _after, result) =>
      `plan commit ${short(result.fromSha)} → ${short(result.intoSha)}: ${result.changes.length} file(s)`
  )
  wrap(
    proto,
    'write',
    (_s, _a, before, after) =>
      `write landed commit ${short(before)} → ${short(after)}`
  )
  const originalResolve = proto.resolve as Method
  proto.resolve = function (this: EntryStore, query: any) {
    resolves++
    if (query?.preview && 'entry' in query.preview)
      trace({
        node: labelOf(this),
        kind: 'preview',
        text: `preview query: fork the database and sync the edited entry into the copy`
      })
    return originalResolve.call(this, query)
  }
  const db = EntryDatabase.prototype as unknown as Record<string, any>
  const overlay = db.overlay as Method
  db.overlay = async function (this: EntryDatabase, ...args: Array<any>) {
    const copy = await overlay.apply(this, args)
    trace({
      node: 'overlay',
      kind: 'overlay',
      text: `forked database for preview at ${short(await copy.getRevision())}`
    })
    return copy
  }
  const reindex = db.reindex as Method
  db.reindex = async function (this: EntryDatabase, ...args: Array<any>) {
    const start = performance.now()
    const result = await reindex.apply(this, args)
    trace({
      node: 'reindex',
      kind: 'reindex',
      text: `derived ${result.changedEntryIds.length} entries again for the new config from stored payloads (${Math.round(performance.now() - start)}ms)`
    })
    return result
  }
}

/** Every entry of a store, in each status, for inspection. */
export async function listEntries(store: EntryStore) {
  const {Entry} = await import('#/core/Entry.js')
  return store.find({
    status: 'all',
    select: {
      id: Entry.id,
      title: Entry.title,
      status: Entry.status,
      filePath: Entry.filePath,
      fileHash: Entry.fileHash
    }
  })
}
