import type {EntryStatus} from '#/core/Entry.js'
import type {EntryAnchorTarget} from '#/core/Field.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {atom} from 'jotai'
import {dispense} from '../AtomUtils.js'
import {keepPrevious} from '../Async.js'
import {entryRevisionAtom} from '../RevisionAtom.js'
import {versionLoaderAtom} from '../EntryLoaderAtoms.js'
import type {EntryDataState} from '../EntryAtoms.js'
import {policyAtom} from '../PolicyAtoms.js'
import {ReactiveNode} from '../ReactiveNode.js'

class EntryLanguageModel {
  constructor(
    public entry: EntryDataState,
    public locale: string | null
  ) {}

  versionsResource = atom(async get => {
    get(entryRevisionAtom(this.entry.id))
    const loader = get(versionLoaderAtom)
    const [entries] = await loader(this.entry.id)
    if (!entries)
      throw new Error(`No versions found for entry ${this.entry.id}`)
    const policy = get(policyAtom)
    const readable = entries.filter(entry => {
      return entry.locale === this.locale && policy.canRead(entry)
    })
    const order = ['draft', 'published', 'archived']
    readable.sort((a, b) => {
      return order.indexOf(a.status) - order.indexOf(b.status)
    })
    return new Map(readable.map(entry => [entry.status, entry] as const))
  })

  versions = keepPrevious(this.versionsResource)

  activeVersionResource = atom(async get => {
    const versions = await get(this.versionsResource)
    const first = versions.values().next().value
    assert(
      first,
      `No versions found for entry ${this.entry.id} and locale ${this.locale}`
    )
    return first
  })

  activeVersion = keepPrevious(this.activeVersionResource)

  anchors = keepPrevious(
    atom(async (get): Promise<Array<EntryAnchorTarget>> => {
      const type = get(this.entry.type).type
      const entry = await get(this.activeVersion)
      return Type.anchors(type, entry.data)
    })
  )

  data = dispense((status: EntryStatus) => {
    return atom(async get => {
      const type = get(this.entry.type).type
      const versions = await get(this.versionsResource)
      const activeStatus = versions.keys().next().value
      const version = versions.get(status)
      assert(version, 'No version found')
      const policy = get(policyAtom)
      // Todo: fix data during indexing instead of here
      const initialValue = Type.withInitialValue(type, {
        ...Type.initialValue(type),
        ...version.data
      })
      const isActiveVersion = status === activeStatus
      return new ReactiveNode<object>(
        initialValue,
        !isActiveVersion || !policy.canUpdate(version)
      )
    })
  })
}

export type EntryLanguage = EntryLanguageModel

export function createEntryLanguage(
  entry: EntryDataState,
  locale: string | null
): EntryLanguage {
  return new EntryLanguageModel(entry, locale)
}
