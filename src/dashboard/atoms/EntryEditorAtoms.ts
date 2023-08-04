import {
  Config,
  Connection,
  EntryPhase,
  EntryRow,
  Field,
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
  locale: string | undefined
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
      get(entryRevisionAtoms(entryId))
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
  const {client, config, availablePhases} = entryData
  const activePhase = availablePhases[0]
  const version = entryData.phases[activePhase]
  const type = config.schema[version.type]
  const docs = fromEntries(
    entries(entryData.phases).map(([phase, version]) => [
      phase,
      createYDoc(type, version)
    ])
  )
  const yDoc = docs[activePhase]
  const yStateVector = Y.encodeStateVector(yDoc)
  const hasChanges = createChangesAtom(yDoc)
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
  const isPublishing = atom(false)
  const view = Type.meta(type).view

  const yUpdate = debounceAtom(
    yAtom(yDoc.getMap(ROOT_KEY), () => {
      return Y.encodeStateAsUpdateV2(yDoc, yStateVector)
    }),
    250
  )

  const selectedPhase = atom(get => {
    const {search} = get(locationAtom)
    const phaseInSearch = search.slice(1)
    if ((<Array<string>>availablePhases).includes(phaseInSearch))
      return <EntryPhase>phaseInSearch
    return activePhase
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
      entryId: version.entryId,
      entry
    }
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
      entryId: version.entryId,
      file: entryFile(version)
    }
    return set(mutateAtom, mutation)
  })

  const resetDraft = atom(null, (get, set) => {
    const type = config.schema[version.type]
    const docRoot = yDoc.getMap(ROOT_KEY)
    for (const [key, field] of entries(type)) {
      const contents = version.data[key]
      docRoot.set(key, Field.shape(field).toY(contents))
    }
    set(hasChanges, false)
  })

  const activeTitle = yAtom(
    yDoc.getMap(ROOT_KEY),
    () => yDoc.getMap(ROOT_KEY).get('title') as string
  )

  function getDraftEntry() {
    const entryData = parseYDoc(type, yDoc)
    return {...version, ...entryData}
  }

  return {
    ...entryData,
    activePhase,
    selectedPhase,
    entryData,
    editMode,
    version,
    type,
    draftState,
    draftEntry,
    yUpdate,
    activeTitle,
    states,
    hasChanges,
    saveDraft,
    publishDraft,
    saveTranslation,
    resetDraft,
    isSaving,
    isPublishing,
    view
  }
}

function createChangesAtom(yDoc: Y.Doc) {
  const hasChanges = atom(false)
  hasChanges.onMount = setAtom => {
    let isCanceled = false
    const cancel = () => {
      if (isCanceled) return
      isCanceled = true
      yDoc.off('update', listener)
    }
    yDoc.on('update', listener)
    return cancel
    function listener() {
      // Todo: check if we made this change
      setAtom(true)
      cancel()
    }
  }
  return hasChanges
}
