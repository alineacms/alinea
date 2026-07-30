import type {Config} from '#/core/Config.js'
import type {Revision} from '#/core/Connection.js'
import type {
  EntryReference,
  EntryReferenceScan
} from '#/core/db/EntryReference.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {
  Entry,
  type Entry as EntryRecord,
  type EntryStatus
} from '#/core/Entry.js'
import type {EntryAnchorTarget} from '#/core/Field.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import type {Policy} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {entries} from '#/core/util/Objects.js'
import {parents, translations} from '#/query.js'
import type {Infer} from '#/types.js'
import {atom, type Atom, type Getter} from 'jotai'
import {graphAtom} from '../graph.js'
import {policyAtom, policyResourceAtom} from '../user.js'
import {batchLoader, dispense, swr, withPending} from '../utils.js'
import {configAtom} from '../config.js'
import {ReactiveNode} from './editor.js'
import type {EntryDataAtoms} from '../entry.js'

export type EntrySidebarTab = 'history' | 'preview' | 'references'

export class MissingEntryError extends Error {
  constructor(public id: string) {
    super(`Missing entry ${id}`)
    this.name = 'MissingEntryError'
  }
}

export interface EntryLoaderAtomsOptions {
  config: Atom<Config>
  graph: Atom<WriteableGraph>
  policy: Atom<Policy>
}

export function createVersionLoaderAtom(graph: Atom<WriteableGraph>) {
  return atom(get => {
    const db = get(graph)
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
}

export function createEntryLoaderAtom(options: EntryLoaderAtomsOptions) {
  return atom(get => {
    const config = get(options.config)
    const db = get(options.graph)
    const policy = get(options.policy)
    return createEntryLoader(config, db, policy)
  })
}

function createEntryLoader(config: Config, db: WriteableGraph, policy: Policy) {
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
      const readableEntries = row.entries.filter(entry => policy.canRead(entry))
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
}

export const versionLoaderAtom = createVersionLoaderAtom(graphAtom)

export const entryLoaderAtom = atom(async get => {
  const config = get(configAtom)
  const db = get(graphAtom)
  const policy = await get(policyResourceAtom)
  return createEntryLoader(config, db, policy)
})

export const entryRevisionAtom = dispense((_id: string) => atom(0))

export const entrySidebarTabAtom = atom<EntrySidebarTab>('preview')
export const entrySidebarOpenAtom = atom(false)

export function allowedEntrySidebarTabs(type: Type): Array<EntrySidebarTab> {
  if (type === MediaFile) return ['references']
  if (type === MediaLibrary) return ['history', 'references']
  return ['preview', 'history', 'references']
}

export function resolveEntrySidebarTab(
  type: Type,
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

export class EntryLanguageAtoms {
  constructor(
    public entry: EntryDataAtoms,
    public locale: string | null
  ) {}

  versionsResource = atom(async get => {
    get(entryRevisionAtom(this.entry.id))
    const loader = get(versionLoaderAtom)
    const [entryVersions] = await loader(this.entry.id)
    if (!entryVersions)
      throw new Error(`No versions found for entry ${this.entry.id}`)
    const policy = get(policyAtom)
    const readable = entryVersions.filter(entry => {
      return entry.locale === this.locale && policy.canRead(entry)
    })
    const order = ['draft', 'published', 'archived']
    readable.sort((a, b) => {
      return order.indexOf(a.status) - order.indexOf(b.status)
    })
    return new Map(readable.map(entry => [entry.status, entry] as const))
  })

  versions = swr(this.versionsResource)

  activeVersionResource = atom(async get => {
    const versions = await get(this.versionsResource)
    const first = versions.values().next().value
    assert(
      first,
      `No versions found for entry ${this.entry.id} and locale ${this.locale}`
    )
    return first
  })

  activeVersion = swr(this.activeVersionResource)

  anchors = swr(
    atom(async (get): Promise<Array<EntryAnchorTarget>> => {
      const type = get(this.entry.type)
      const entry = await get(this.activeVersion)
      return Type.anchors(type, entry.data)
    })
  )

  data = dispense((status: EntryStatus) => {
    return atom(async get => {
      const type = get(this.entry.type)
      const versions = await get(this.versionsResource)
      const activeStatus = versions.keys().next().value
      const version = versions.get(status)
      assert(version, 'No version found')
      const policy = get(policyAtom)
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

export interface PreparedEntryPage {
  type: 'entry'
  entry: EntryDataAtoms
  locale: string | null
  node: ReactiveNode<object>
  activeVersion: EntryRecord<Record<string, unknown>> | null
  currentEntry: EntryRecord<Record<string, unknown>> | null
  parentNeedsTranslation: boolean
  languageVersion: EntryRecord<Record<string, unknown>>
  versions: Map<EntryStatus, EntryRecord<Record<string, unknown>>>
  sidebar: Atom<EntrySidebarState>
}

export type EntryPageData = PreparedEntryPage

export type EntrySidebarData =
  | ClosedSidebarData
  | ErrorSidebarData
  | PreviewSidebarData
  | HistorySidebarData
  | ReferencesSidebarData

export interface EntrySidebarState {
  data: EntrySidebarData | undefined
  pending: boolean
}

export interface ClosedSidebarData {
  type: 'closed'
}

export interface ErrorSidebarData {
  type: 'error'
  error: Error
}

export interface PreviewSidebarData {
  type: 'preview'
  entry: EntryRecord<Record<string, unknown>> | null
  url: string | undefined
}

export interface HistorySidebarData {
  type: 'history'
  statuses: Array<EntryStatus>
  history: Array<Revision>
}

export interface ReferencesSidebarData {
  type: 'references'
  references: DashboardEntryReferences
}

export function createEntrySidebarResource(
  entry: EntryDataAtoms,
  locale: string | null,
  loadSidebar = loadEntrySidebar
): Atom<Promise<EntrySidebarData>> {
  return atom(async get => {
    if (!get(entrySidebarOpenAtom)) return {type: 'closed' as const}
    const tab = resolveEntrySidebarTab(
      get(entry.type),
      get(entrySidebarTabAtom)
    )
    try {
      return await loadSidebar(get, entry, locale, tab)
    } catch (cause) {
      return {
        type: 'error' as const,
        error: cause instanceof Error ? cause : new Error(String(cause))
      }
    }
  })
}

export async function loadEntrySidebar(
  get: Getter,
  entry: EntryDataAtoms,
  locale: string | null,
  tab: EntrySidebarTab
): Promise<EntrySidebarData> {
  switch (tab) {
    case 'preview': {
      const preview = get(entry.preview)
      return {
        type: 'preview',
        entry:
          preview && preview !== true
            ? await get(entry.previewEntryFor(locale))
            : null,
        url:
          preview === true ? await get(entry.previewUrlFor(locale)) : undefined
      }
    }
    case 'history': {
      const [statuses, history] = await Promise.all([
        get(entry.availableStatusesFor(locale)),
        get(entry.historyFor(locale))
      ])
      return {type: 'history', statuses, history}
    }
    case 'references':
      return {
        type: 'references',
        references: await get(entry.incomingReferencesResource)
      }
  }
}

export async function loadEntryPage(
  get: Getter,
  entry: EntryDataAtoms,
  locale: string | null,
  sidebarResource = createEntrySidebarResource(entry, locale)
): Promise<EntryPageData> {
  const sourceLocale = entry.sourceLocaleFor(get, locale)
  const language = entry.languages(sourceLocale)
  const [
    versions,
    languageVersion,
    node,
    activeVersion,
    currentEntry,
    parentNeedsTranslation
  ] = await Promise.all([
    get(language.versionsResource),
    get(language.activeVersionResource),
    get(entry.selectedNodeFor(locale)),
    get(entry.activeVersionFor(locale)),
    get(entry.currentEntryFor(locale)),
    get(entry.parentNeedsTranslationFor(locale))
  ])
  const sidebarOpen = get(entrySidebarOpenAtom)
  const sidebarTab = resolveEntrySidebarTab(
    get(entry.type),
    get(entrySidebarTabAtom)
  )
  const initialSidebar =
    sidebarOpen && sidebarTab !== 'preview'
      ? await get(sidebarResource)
      : undefined
  const sidebarState = withPending(sidebarResource)
  const sidebar = atom((get): EntrySidebarState => {
    const [pending, data] = get(sidebarState)
    return {pending, data: data ?? initialSidebar}
  })
  return {
    type: 'entry',
    entry,
    locale,
    node,
    activeVersion,
    currentEntry,
    parentNeedsTranslation,
    languageVersion,
    versions,
    sidebar
  }
}
