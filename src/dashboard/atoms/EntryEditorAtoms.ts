import {
  Config,
  Connection,
  EntryPhase,
  EntryRow,
  ROOT_KEY,
  Type,
  createId,
  createYDoc,
  parseYDoc
} from 'alinea/core'
import {Entry} from 'alinea/core/Entry'
import {entryFileName} from 'alinea/core/EntryFilenames'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {entries, fromEntries, values} from 'alinea/core/util/Objects'
import {InputState} from 'alinea/editor'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import * as Y from 'yjs'
import {debounceAtom} from '../util/DebounceAtom.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {entryRevisionAtoms, graphAtom, mutateAtom} from './DbAtoms.js'
import {locationAtom} from './LocationAtoms.js'
import {pendingAtom} from './PendingAtoms.js'
import {yAtom} from './YAtom.js'

export enum EditMode {
  Editing = 'editing',
  Diff = 'diff'
}

export type Version = Entry & {parents: Array<string>}

const previewTokenAtom = atom(async get => {
  const client = get(clientAtom)
  return client.previewToken()
})

interface EntryEditorParams {
  locale: string | null
  i18nId: string | undefined
}

export const entryEditorAtoms = atomFamily(
  ({locale, i18nId}: EntryEditorParams) => {
    return atom(async get => {
      if (!i18nId) return undefined
      const config = get(configAtom)
      const client = get(clientAtom)
      const graph = await get(graphAtom)
      const search = locale ? {i18nId, locale} : {i18nId}
      let entry = await graph.active.maybeGet(Entry(search))
      if (!entry) {
        const {searchParams} = get(locationAtom)
        const preferredLanguage = searchParams.get('from')
        entry = await graph.active.maybeGet(
          Entry({i18nId}).where(
            preferredLanguage ? Entry.locale.is(preferredLanguage) : true
          )
        )
      }
      if (!entry) return undefined
      const entryId = entry.entryId
      get(entryRevisionAtoms(entryId))
      const versions = await graph.all.find(
        Entry({entryId}).select({
          ...Entry,
          parents({parents}) {
            return parents().select(Entry.i18nId)
          }
        })
      )
      const {parents} = await graph.active.get(
        Entry({entryId}).select({
          parents({parents}) {
            return parents().select({entryId: Entry.entryId, path: Entry.path})
          }
        })
      )
      const translations = (await graph.active.find(
        Entry({i18nId})
          .where(Entry.locale.isNotNull(), Entry.entryId.isNot(entryId))
          .select({locale: Entry.locale, entryId: Entry.entryId})
      )) as Array<{locale: string; entryId: string}>
      if (versions.length === 0) return undefined
      const phases = fromEntries(
        versions.map(version => [version.phase, version])
      ) as Record<EntryPhase, Version>
      const availablePhases = values(EntryPhase).filter(
        phase => phases[phase] !== undefined
      )
      const previewToken = await get(previewTokenAtom)
      return createEntryEditor({
        parents,
        translations,
        previewToken,
        client,
        config,
        entryId,
        versions,
        phases,
        availablePhases
      })
    })
  },
  (a, b) => a.locale === b.locale && a.i18nId === b.i18nId
)

export interface EntryData {
  parents: Array<{entryId: string; path: string}>
  client: Connection
  config: Config
  entryId: string
  versions: Array<Version>
  phases: Record<EntryPhase, Version>
  availablePhases: Array<EntryPhase>
  translations: Array<{locale: string; entryId: string}>
  previewToken: string
}

export type EntryEditor = ReturnType<typeof createEntryEditor>

export function createEntryEditor(entryData: EntryData) {
  const {config, availablePhases} = entryData
  const activePhase = availablePhases[0]
  const activeVersion = entryData.phases[activePhase]
  const type = config.schema[activeVersion.type]
  const docs = fromEntries(
    entries(entryData.phases).map(([phase, version]) => [
      phase,
      createYDoc(type, version)
    ])
  )
  const yDoc = docs[activePhase]
  const yStateVector = Y.encodeStateVector(yDoc)
  const hasChanges = createChangesAtom(yDoc.getMap(ROOT_KEY))
  const states = fromEntries(
    entries(docs).map(([phase, doc]) => [
      phase,
      new InputState.YDocState(Type.shape(type), doc.getMap(ROOT_KEY), '')
    ])
  )
  const draftState = states[activePhase]
  const draftEntry = yAtom(yDoc.getMap(ROOT_KEY), getDraftEntry)
  const editMode = atom(EditMode.Editing)
  const isSaving = atom(false)
  const view = Type.meta(type).view

  const isPublishing = atom(get => {
    const pending = get(pendingAtom)
    return pending.some(
      mutation =>
        mutation.type === MutationType.Publish &&
        mutation.entryId === activeVersion.entryId
    )
  })

  const isArchiving = atom(get => {
    const pending = get(pendingAtom)
    return pending.some(
      mutation =>
        mutation.type === MutationType.Archive &&
        mutation.entryId === activeVersion.entryId
    )
  })

  const yUpdate = debounceAtom(
    yAtom(yDoc.getMap(ROOT_KEY), () => {
      return Y.encodeStateAsUpdateV2(yDoc, yStateVector)
    }),
    250
  )

  const phaseInUrl = atom(get => {
    const {search} = get(locationAtom)
    const phaseInSearch = search.slice(1)
    if ((<Array<string>>availablePhases).includes(phaseInSearch))
      return <EntryPhase>phaseInSearch
    return undefined
  })

  const selectedPhase = atom(get => {
    return get(phaseInUrl) ?? activePhase
  })

  function entryFile(entry: EntryRow) {
    return entryFileName(
      config,
      entry,
      entryData.parents.map(p => p.path)
    )
  }

  const saveDraft = atom(null, (get, set) => {
    const entry = {...getDraftEntry(), phase: EntryPhase.Draft}
    const mutation: Mutation = {
      type: MutationType.Edit,
      file: entryFile(entry),
      entryId: activeVersion.entryId,
      entry
    }
    set(hasChanges, false)
    return set(mutateAtom, mutation)
  })

  const saveTranslation = atom(null, (get, set, locale: string) => {
    const entryId = createId()
    const entry = {...getDraftEntry(), entryId, locale, phase: EntryPhase.Draft}
    const mutation: Mutation = {
      type: MutationType.Edit,
      file: entryFile(entry),
      entryId,
      entry
    }
    throw new Error('Calulate parent paths correctly here')
    return set(mutateAtom, mutation)
  })

  const publishDraft = atom(null, (get, set) => {
    const mutation: Mutation = {
      type: MutationType.Publish,
      entryId: activeVersion.entryId,
      file: entryFile(activeVersion)
    }
    return set(mutateAtom, mutation)
  })

  const discardDraft = atom(null, (get, set) => {
    const mutation: Mutation = {
      type: MutationType.Discard,
      entryId: activeVersion.entryId,
      file: entryFile(activeVersion)
    }
    return set(mutateAtom, mutation)
  })

  const archivePublished = atom(null, (get, set) => {
    const published = entryData.phases[EntryPhase.Published]
    const mutation: Mutation = {
      type: MutationType.Archive,
      entryId: published.entryId,
      file: entryFile(published)
    }
    return set(mutateAtom, mutation)
  })

  const publishArchived = atom(null, (get, set) => {
    const archived = entryData.phases[EntryPhase.Archived]
    const mutation: Mutation = {
      type: MutationType.Publish,
      entryId: archived.entryId,
      file: entryFile(archived)
    }
    return set(mutateAtom, mutation)
  })

  const discardEdits = atom(null, (get, set) => {
    set(entryRevisionAtoms(activeVersion.entryId))
  })

  const activeTitle = yAtom(
    yDoc.getMap(ROOT_KEY),
    () => yDoc.getMap(ROOT_KEY).get('title') as string
  )

  function getDraftEntry() {
    const entryData = parseYDoc(type, yDoc)
    return {...activeVersion, ...entryData}
  }

  return {
    ...entryData,
    revisionId: createId(),
    activePhase,
    phaseInUrl,
    selectedPhase,
    entryData,
    editMode,
    activeVersion,
    type,
    draftState,
    draftEntry,
    yUpdate,
    activeTitle,
    states,
    hasChanges,
    saveDraft,
    publishDraft,
    discardDraft,
    archivePublished,
    publishArchived,
    saveTranslation,
    discardEdits,
    isSaving,
    isPublishing,
    isArchiving,
    view
  }
}

function createChangesAtom(yMap: Y.Map<unknown>) {
  const hasChanges = atom(false)
  hasChanges.onMount = (setAtom: (value: boolean) => void) => {
    const listener = (events: Array<Y.YEvent<any>>, tx: Y.Transaction) => {
      setAtom(true)
    }
    yMap.observeDeep(listener)
    return () => yMap.unobserveDeep(listener)
  }
  return hasChanges
}
