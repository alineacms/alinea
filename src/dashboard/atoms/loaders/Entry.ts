import type {Revision} from '#/core/Connection.js'
import type {Entry as EntryRecord, EntryStatus} from '#/core/Entry.js'
import type {Getter} from 'jotai'
import type {EntryDataState} from '../EntryAtoms.js'
import type {EntrySidebarTab} from '../Contracts.js'
import type {ReactiveNode} from '../ReactiveNode.js'
import type {DashboardEntryReferences} from '../entry/EntryContracts.js'
import {
  entrySidebarOpenAtom,
  entrySidebarTabAtom
} from '../PageAtoms.js'

export interface PreparedEntryPage {
  type: 'entry'
  entry: EntryDataState
  locale: string | null
  node: ReactiveNode<object>
  activeVersion: EntryRecord<Record<string, unknown>> | null
  currentEntry: EntryRecord<Record<string, unknown>> | null
  parentNeedsTranslation: boolean
  languageVersion: EntryRecord<Record<string, unknown>>
  versions: Map<EntryStatus, EntryRecord<Record<string, unknown>>>
  sidebar: EntrySidebarData
}

export type EntryPageData = PreparedEntryPage

export type EntrySidebarData =
  | ClosedSidebarData
  | PreviewSidebarData
  | HistorySidebarData
  | ReferencesSidebarData

export interface ClosedSidebarData {
  type: 'closed'
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

export async function loadEntrySidebar(
  get: Getter,
  entry: EntryDataState,
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
  entry: EntryDataState,
  locale: string | null
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
  const sidebar = get(entrySidebarOpenAtom)
    ? await loadEntrySidebar(
        get,
        entry,
        locale,
        get(entrySidebarTabAtom)
      )
    : {type: 'closed' as const}
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
