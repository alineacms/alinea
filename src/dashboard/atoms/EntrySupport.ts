import type {
  EntryReference,
  EntryReferenceScan
} from '#/core/db/EntryReference.js'
import type {EntryStatus} from '#/core/Entry.js'
import type {EntryAnchorTarget} from '#/core/Field.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import type {Infer} from '#/types.js'
import {atom} from 'jotai'
import {dispense, keepPrevious} from './AtomUtils.js'
import type {EntrySidebarTab} from './Contracts.js'
import type {EntryDataState} from './EntryAtoms.js'
import type {TypeState} from './EditorAtoms.js'
import {versionLoaderAtom} from './EntryLoaderAtoms.js'
import {policyAtom} from './PolicyAtoms.js'
import {ReactiveNode} from './ReactiveNode.js'

export const entryRevisionAtom = dispense((_id: string) => atom(0))

const entrySidebarTabStateAtom = atom<EntrySidebarTab>('preview')

export const entrySidebarTabAtom = atom(
  get => get(entrySidebarTabStateAtom),
  (_get, set, tab: EntrySidebarTab) => {
    set(entrySidebarTabStateAtom, tab)
  }
)

const entrySidebarOpenStateAtom = atom(true)

export const entrySidebarOpenAtom = atom(
  get => get(entrySidebarOpenStateAtom),
  (_get, set, open: boolean) => {
    set(entrySidebarOpenStateAtom, open)
  }
)

export function allowedEntrySidebarTabs(
  type: TypeState
): Array<EntrySidebarTab> {
  if (type.type === MediaFile) return ['references']
  if (type.type === MediaLibrary) return ['history', 'references']
  return ['preview', 'history', 'references']
}

export function resolveEntrySidebarTab(
  type: TypeState,
  selected: EntrySidebarTab
): EntrySidebarTab {
  const allowed = allowedEntrySidebarTabs(type)
  return allowed.includes(selected) ? selected : allowed[0]
}

export interface DashboardEntryTreeStatus {
  status: EntryStatus | 'unpublished' | 'untranslated'
}

export interface DashboardFileInfoState {
  pending: boolean
  data: Infer<typeof MediaFile> | null | undefined
}

export interface DashboardEntryReferences {
  references: Array<DashboardEntryReference>
  total: number
  scan: EntryReferenceScan
}

export interface DashboardEntryReference {
  reference: EntryReference
  source: DashboardEntryReferenceSource
}

export interface DashboardEntryReferenceSource {
  id: string
  title: string
  type: string
  workspace: string
  root: string
  locale: string | null
  status: EntryStatus
  path: string
  url: string
}

export interface EntryRouteBlock {
  confirm(): void
  cancel(): void
}

export class EntryLanguageModel {
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
