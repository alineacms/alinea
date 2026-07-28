import {Entry} from '#/core/Entry.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {parents, translations} from '#/query.js'
import {atom} from 'jotai'
import {configAtom, graphAtom} from './CoreAtoms.js'
import {MissingEntryError} from './Contracts.js'
import {policyAtom} from './PolicyAtoms.js'

type Result<Value> =
  | [value: Value, error: null]
  | [value: null, error: Error]

type BatchLoadFn<Value> = (
  keys: ReadonlyArray<string>
) => Promise<ReadonlyArray<Result<Value>>>

export const versionLoaderAtom = atom(get => {
  const db = get(graphAtom)
  return batchLoader(async ids => {
    const rows = await db.find({
      id: {in: ids},
      status: 'all',
      select: Entry
    })
    const byId = new Map<string, Array<(typeof rows)[number]>>()
    for (const row of rows) {
      const versions = byId.get(row.id)
      if (versions) versions.push(row)
      else byId.set(row.id, [row])
    }
    return ids.map(id => [byId.get(id) ?? [], null] as const)
  })
})

export const entryLoaderAtom = atom(get => {
  const config = get(configAtom)
  const db = get(graphAtom)
  const policy = get(policyAtom)
  const visibleTypes = entries(config.schema)
    .filter(([, type]) => !Type.isHidden(type))
    .map(([name]) => name)
  return batchLoader(async ids => {
    const rows = await db.find({
      groupBy: Entry.id,
      select: {
        id: Entry.id,
        type: Entry.type,
        parentId: Entry.parentId,
        workspace: Entry.workspace,
        root: Entry.root,
        parents: parents({
          select: {
            id: Entry.id,
            path: Entry.path,
            type: Entry.type,
            status: Entry.status,
            main: Entry.main
          }
        }),
        entries: translations({select: Entry, includeSelf: true})
      },
      id: {in: ids},
      status: 'preferDraft'
    })
    const parentIds = await db.find({
      select: Entry.parentId,
      parentId: {in: ids},
      filter: {_type: {in: visibleTypes}},
      groupBy: Entry.parentId,
      status: 'preferDraft'
    })
    const parentIdSet = new Set(parentIds)
    const byId = new Map(rows.map(row => [row.id, row] as const))
    return ids.map(id => {
      const row = byId.get(id)
      if (!row) return [null, new MissingEntryError(id)] as const
      const readableEntries = row.entries.filter(entry =>
        policy.canRead(entry)
      )
      if (readableEntries.length === 0)
        return [null, new MissingEntryError(id)] as const
      return [
        {
          ...row,
          entries: readableEntries,
          hasChildren: parentIdSet.has(id)
        },
        null
      ] as const
    })
  })
})

function batchLoader<Value>(fn: BatchLoadFn<Value>) {
  let batch: Array<{
    key: string
    resolve: (value: Result<Value>) => void
  }> = []
  return (key: string): Promise<Result<Value>> => {
    return new Promise(resolve => {
      if (batch.push({key, resolve}) === 1) {
        queueMicrotask(async () => {
          const current = batch
          batch = []
          try {
            const keys = [...new Set(current.map(item => item.key))]
            const result = await fn(keys)
            const byKey = new Map(
              keys.map((key, index) => [key, result[index]] as const)
            )
            for (const item of current) {
              item.resolve(
                byKey.get(item.key) ?? [
                  null,
                  new Error(`Missing result for ${item.key}`)
                ]
              )
            }
          } catch (error) {
            const reason =
              error instanceof Error ? error : new Error(String(error))
            for (const item of current) item.resolve([null, reason])
          }
        })
      }
    })
  }
}
