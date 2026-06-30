import type {Config} from '#/core/Config.js'
import type {EntryCondition} from '#/core/db/EntryIndex.js'
import {
  type EntryReference,
  type EntryReferenceQuery,
  type EntryReferenceResult,
  type EntryReferenceScan,
  type EntryReferenceTarget
} from '#/core/db/EntryReference.js'
import type {Entry} from '#/core/Entry.js'
import {Type} from '#/core/Type.js'

export interface EntryReferenceGraph {
  config: Config
  filter(filter: EntryCondition): Iterable<Entry>
}

export interface EntryReferenceBuildOptions {
  onProgress?: (scan: EntryReferenceScan) => void
}

export class EntryReferenceIndex {
  #config: Config
  #refsByFilePath = new Map<string, Array<EntryReference>>()
  #refsBySourceId = new Map<string, Array<EntryReference>>()
  #refsByTargetId = new Map<string, Array<EntryReference>>()
  #indexedFilePaths = new Set<string>()

  static async build(
    graph: EntryReferenceGraph,
    options: EntryReferenceBuildOptions = {}
  ): Promise<EntryReferenceIndex> {
    const index = new EntryReferenceIndex(graph.config)
    const entries = Array.from(graph.filter({}))
    let scanned = 0
    options.onProgress?.({
      scanned,
      total: entries.length,
      complete: entries.length === 0
    })
    for (const entry of entries) {
      index.replaceEntry(entry)
      scanned += 1
      options.onProgress?.({
        scanned,
        total: entries.length,
        complete: scanned === entries.length
      })
      if (scanned % 100 === 0) await Promise.resolve()
    }
    return index
  }

  constructor(config: Config) {
    this.#config = config
  }

  referencesTo(query: EntryReferenceQuery): EntryReferenceResult {
    const all = this.#refsByTargetId.get(query.targetId) ?? []
    const filtered = all.filter(ref => matchesReferenceQuery(ref, query))
    return {
      references: filtered,
      total: filtered.length,
      scan: {
        scanned: this.#indexedFilePaths.size,
        total: this.#indexedFilePaths.size,
        complete: true
      }
    }
  }

  referencesFrom(sourceId: string): Array<EntryReference> {
    return [...(this.#refsBySourceId.get(sourceId) ?? [])]
  }

  replaceEntry(entry: Entry): Set<string> {
    this.#indexedFilePaths.add(entry.filePath)
    return this.replaceFile(
      entry.filePath,
      entryReferences(this.#config, entry)
    )
  }

  removeFile(filePath: string): Set<string> {
    this.#indexedFilePaths.delete(filePath)
    return this.replaceFile(filePath, [])
  }

  replaceFile(
    filePath: string,
    references: Array<EntryReference>
  ): Set<string> {
    const affected = new Set<string>()
    const previous = this.#refsByFilePath.get(filePath) ?? []
    for (const reference of previous) {
      affected.add(reference.targetId)
      removeReference(this.#refsBySourceId, reference.sourceId, reference)
      removeReference(this.#refsByTargetId, reference.targetId, reference)
    }
    if (references.length > 0) this.#refsByFilePath.set(filePath, references)
    else this.#refsByFilePath.delete(filePath)
    for (const reference of references) {
      affected.add(reference.targetId)
      addReference(this.#refsBySourceId, reference.sourceId, reference)
      addReference(this.#refsByTargetId, reference.targetId, reference)
    }
    return affected
  }
}

function entryReferences(config: Config, entry: Entry): Array<EntryReference> {
  const type = config.schema[entry.type]
  if (!type) return []
  return Type.references(type, entry.data).map(target => {
    return entryReference(entry, target)
  })
}

function entryReference(
  entry: Entry,
  target: EntryReferenceTarget
): EntryReference {
  return {
    ...target,
    sourceId: entry.id,
    sourceFilePath: entry.filePath,
    sourceType: entry.type,
    sourceLocale: entry.locale,
    sourceStatus: entry.status,
    sourceActive: entry.active,
    sourceMain: entry.main
  }
}

function addReference(
  map: Map<string, Array<EntryReference>>,
  key: string,
  reference: EntryReference
) {
  const references = map.get(key)
  if (references) references.push(reference)
  else map.set(key, [reference])
}

function removeReference(
  map: Map<string, Array<EntryReference>>,
  key: string,
  reference: EntryReference
) {
  const current = map.get(key)
  if (!current) return
  const next = current.filter(item => item !== reference)
  if (next.length > 0) map.set(key, next)
  else map.delete(key)
}

function matchesReferenceQuery(
  reference: EntryReference,
  query: EntryReferenceQuery
): boolean {
  if (query.locale !== undefined && reference.sourceLocale !== query.locale)
    return false
  switch (query.status ?? 'published') {
    case 'published':
      return reference.sourceStatus === 'published'
    case 'draft':
      return reference.sourceStatus === 'draft'
    case 'archived':
      return reference.sourceStatus === 'archived'
    case 'preferDraft':
      return reference.sourceActive
    case 'preferPublished':
      return reference.sourceMain
    case 'all':
      return true
  }
}
