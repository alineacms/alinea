import {
  Config,
  Connection,
  EntryPhase,
  EntryRow,
  ROOT_KEY,
  Type,
  applyEntryData,
  createId,
  createYDoc,
  parseYDoc
} from 'alinea/core'
import {Entry} from 'alinea/core/Entry'
import {entryFileName} from 'alinea/core/EntryFilenames'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {MediaFile} from 'alinea/core/media/MediaSchema'
import {entries, fromEntries, values} from 'alinea/core/util/Objects'
import {InputState} from 'alinea/editor'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import * as Y from 'yjs'
import {debounceAtom} from '../util/DebounceAtom.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {
  entryRevisionAtoms,
  graphAtom,
  mutateAtom,
  sourceGraphAtom
} from './DbAtoms.js'
import {errorAtom} from './ErrorAtoms.js'
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
      const sourceGraph = await get(sourceGraphAtom)
      const graph = await get(graphAtom)
      const search = locale ? {i18nId, locale} : {i18nId}
      let entry = await graph.preferDraft.maybeGet(Entry(search))
      if (!entry) {
        const {searchParams} = get(locationAtom)
        const preferredLanguage = searchParams.get('from')
        entry = await graph.preferDraft.maybeGet(
          Entry({i18nId}).where(
            preferredLanguage ? Entry.locale.is(preferredLanguage) : true
          )
        )
      }
      if (!entry) return undefined
      const entryId = entry.entryId
      get(entryRevisionAtoms(entryId))
      const sourceEntry = await sourceGraph.preferDraft.get(Entry({entryId}))
      const versions = await graph.all.find(
        Entry({entryId}).select({
          ...Entry,
          parents({parents}) {
            return parents().select(Entry.i18nId)
          }
        })
      )
      const {parents} = await graph.preferDraft.get(
        Entry({entryId}).select({
          parents({parents}) {
            return parents().select({entryId: Entry.entryId, path: Entry.path})
          }
        })
      )
      const translations = (await graph.preferDraft.find(
        Entry({i18nId})
          .where(Entry.locale.isNotNull(), Entry.entryId.isNot(entryId))
          .select({locale: Entry.locale, entryId: Entry.entryId})
      )) as Array<{locale: string; entryId: string}>
      const parentLink =
        entry.parent &&
        (await graph.preferDraft.get(
          Entry({entryId: entry.parent}).select(Entry.i18nId)
        ))
      const parentNeedsTranslation = parentLink
        ? !(await graph.preferDraft.maybeGet(
            Entry({i18nId: parentLink, locale})
          ))
        : false
      if (versions.length === 0) return undefined
      const phases = fromEntries(
        versions.map(version => [version.phase, version])
      ) as Record<EntryPhase, Version>
      const availablePhases = values(EntryPhase).filter(
        phase => phases[phase] !== undefined
      )
      const previewToken = await get(previewTokenAtom)
      return createEntryEditor({
        sourceEntry,
        parents,
        translations,
        parentNeedsTranslation,
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
  sourceEntry: EntryRow | null
  parents: Array<{entryId: string; path: string}>
  client: Connection
  config: Config
  entryId: string
  versions: Array<Version>
  phases: Record<EntryPhase, Version>
  availablePhases: Array<EntryPhase>
  translations: Array<{locale: string; entryId: string}>
  parentNeedsTranslation: boolean
  previewToken: string
}

export type EntryEditor = ReturnType<typeof createEntryEditor>

const showHistoryAtom = atom(true)

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
  const showHistory = showHistoryAtom

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

  const yStateVector = Y.encodeStateVector(
    createYDoc(type, entryData.sourceEntry)
  )
  const yUpdate = debounceAtom(
    yAtom(yDoc.getMap(ROOT_KEY), () => {
      const draftEntry = getDraftEntry()
      const sourceDoc = createYDoc(type, entryData.sourceEntry)
      applyEntryData(sourceDoc, type, draftEntry)
      return Y.encodeStateAsUpdateV2(sourceDoc, yStateVector)
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

  function entryFile(entry: EntryRow, parentPaths?: Array<string>) {
    return entryFileName(
      config,
      entry,
      parentPaths ?? entryData.parents.map(p => p.path)
    )
  }

  const saveDraft = atom(null, (get, set) => {
    const entry = {...getDraftEntry(), phase: EntryPhase.Draft}
    const mutation: Mutation = {
      type: MutationType.Edit,
      previousFile: entryFile(activeVersion),
      file: entryFile(entry),
      entryId: activeVersion.entryId,
      entry
    }
    set(hasChanges, false)
    return set(mutateAtom, mutation).catch(error => {
      set(hasChanges, true)
      set(
        errorAtom,
        'Could not complete save action, please try again later',
        error
      )
    })
  })

  const saveTranslation = atom(null, async (get, set, locale: string) => {
    const {preferDraft: active} = await get(graphAtom)
    const parentLink =
      activeVersion.parent &&
      (await active.get(
        Entry({entryId: activeVersion.parent}).select(Entry.i18nId)
      ))
    if (activeVersion.parent && !parentLink) throw new Error('Parent not found')
    const parentData = parentLink
      ? await active.locale(locale).get(
          Entry({i18nId: parentLink}).select({
            entryId: Entry.entryId,
            path: Entry.path,
            paths({parents}) {
              return parents().select(Entry.path)
            }
          })
        )
      : undefined
    if (activeVersion.parent && !parentData)
      throw new Error('Parent not translated')
    const entryId = createId()
    const entry = {
      ...getDraftEntry(),
      parent: parentData?.entryId ?? null,
      entryId,
      locale,
      phase: EntryPhase.Published
    }
    const mutation: Mutation = {
      type: MutationType.Create,
      file: entryFile(
        entry,
        parentData?.paths ? parentData.paths.concat(parentData.path) : []
      ),
      entryId,
      entry
    }
    const res = set(mutateAtom, mutation)
    set(entryRevisionAtoms(activeVersion.entryId))
    set(hasChanges, false)
    return res.catch(error => {
      set(hasChanges, true)
      set(
        errorAtom,
        'Could not complete translate action, please try again later',
        error
      )
    })
  })

  const publishEdits = atom(null, (get, set) => {
    const currentFile = entryFile(activeVersion)
    const entry = {...getDraftEntry(), phase: EntryPhase.Published}
    const mutations: Array<Mutation> = []
    const editedFile = entryFile(entry)
    mutations.push({
      type: MutationType.Edit,
      previousFile: currentFile,
      file: editedFile,
      entryId: activeVersion.entryId,
      entry
    })
    set(hasChanges, false)
    return set(mutateAtom, ...mutations).catch(error => {
      set(hasChanges, true)
      set(
        errorAtom,
        'Could not complete publish action, please try again later',
        error
      )
    })
  })

  const publishDraft = atom(null, (get, set) => {
    const mutation: Mutation = {
      type: MutationType.Publish,
      entryId: activeVersion.entryId,
      file: entryFile(activeVersion)
    }
    return set(mutateAtom, mutation).catch(error => {
      set(
        errorAtom,
        'Could not complete publish action, please try again later',
        error
      )
    })
  })

  const discardDraft = atom(null, (get, set) => {
    const mutation: Mutation = {
      type: MutationType.Discard,
      entryId: activeVersion.entryId,
      file: entryFile(activeVersion)
    }
    return set(mutateAtom, mutation).catch(error => {
      set(
        errorAtom,
        'Could not complete remove action, please try again later',
        error
      )
    })
  })

  const archivePublished = atom(null, (get, set) => {
    const published = entryData.phases[EntryPhase.Published]
    const mutation: Mutation = {
      type: MutationType.Archive,
      entryId: published.entryId,
      file: entryFile(published)
    }
    return set(mutateAtom, mutation).catch(error => {
      set(
        errorAtom,
        'Could not complete archive action, please try again later',
        error
      )
    })
  })

  const publishArchived = atom(null, (get, set) => {
    const archived = entryData.phases[EntryPhase.Archived]
    const mutation: Mutation = {
      type: MutationType.Publish,
      entryId: archived.entryId,
      file: entryFile(archived)
    }
    return set(mutateAtom, mutation).catch(error => {
      set(
        errorAtom,
        'Could not complete publish action, please try again later',
        error
      )
    })
  })

  const deleteFile = atom(null, (get, set) => {
    const published = entryData.phases[EntryPhase.Published]
    const mutation: Mutation = {
      type: MutationType.FileRemove,
      entryId: published.entryId,
      workspace: published.workspace,
      location: (published.data as MediaFile).location,
      file: entryFile(published)
    }
    return set(mutateAtom, mutation).catch(error => {
      set(
        errorAtom,
        'Could not complete delete action, please try again later',
        error
      )
    })
  })

  const deleteArchived = atom(null, (get, set) => {
    const archived = entryData.phases[EntryPhase.Archived]
    const mutation: Mutation = {
      type: MutationType.Remove,
      entryId: archived.entryId,
      file: entryFile(archived)
    }
    return set(mutateAtom, mutation).catch(error => {
      set(
        errorAtom,
        'Could not complete delete action, please try again later',
        error
      )
    })
  })

  const discardEdits = atom(null, (get, set) => {
    set(hasChanges, false)
    set(entryRevisionAtoms(activeVersion.entryId))
  })

  const activeTitle = yAtom(
    yDoc.getMap(ROOT_KEY),
    () => yDoc.getMap(ROOT_KEY).get('title') as string
  )

  function getDraftEntry(): EntryRow {
    const entryData = parseYDoc(type, yDoc)
    return {...activeVersion, ...entryData}
  }

  const revisionsAtom = atom(async get => {
    const client = get(clientAtom)
    const file = entryFile(activeVersion)
    return client.revisions(file)
  })

  const rollbackRevision = atom(null, async (get, set, revisionId: string) => {
    const client = get(clientAtom)
    const file = entryFile(activeVersion)
    const entryData = await client.revisionData(file, revisionId)
    console.log(entryData)
  })

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
    publishEdits,
    publishDraft,
    discardDraft,
    archivePublished,
    publishArchived,
    deleteFile,
    deleteArchived,
    saveTranslation,
    discardEdits,
    isSaving,
    showHistory,
    isPublishing,
    isArchiving,
    view,
    revisionsAtom,
    rollbackRevision
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
