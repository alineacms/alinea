import {Config, EntryPhase, Field, ROOT_KEY, Type} from 'alinea/core'
import {Client} from 'alinea/core/Client'
import {Page} from 'alinea/core/pages/Page'
import {Realm} from 'alinea/core/pages/Realm'
import {entries, fromEntries, values} from 'alinea/core/util/Objects'
import {InputState} from 'alinea/editor'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import * as Y from 'yjs'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {entryRevisionAtoms, findAtom} from './EntryAtoms.js'
import {locationAtom} from './LocationAtoms.js'
import {yAtom} from './YAtom.js'

export enum EditMode {
  Editing = 'editing',
  Diff = 'diff'
}

export type Version = Page & {parents: Array<string>}

export const entryEditorAtoms = atomFamily((entryId: string) => {
  return atom(async get => {
    const config = get(configAtom)
    const client = get(clientAtom)
    const find = await get(findAtom)
    get(entryRevisionAtoms(entryId))
    const versions = await find(
      Page({entryId}).select({
        ...Page,
        parents({parents}) {
          return parents(Page).select(Page.entryId)
        }
      }),
      Realm.All
    )
    if (versions.length === 0) return undefined
    const phases = fromEntries(
      versions.map(version => [version.phase, version])
    ) as Record<EntryPhase, Version>
    const availablePhases = values(EntryPhase).filter(
      phase => phases[phase] !== undefined
    )
    return createEntryEditor({
      client,
      config,
      entryId,
      versions,
      phases,
      availablePhases
    })
  })
})

export interface EntryData {
  client: Client
  config: Config
  entryId: string
  versions: Array<Version>
  phases: Record<EntryPhase, Version>
  availablePhases: Array<EntryPhase>
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
      createYDoc(config, version)
    ])
  )
  const yDoc = docs[activePhase]
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

  const selectedPhase = atom(get => {
    const {search} = get(locationAtom)
    const phaseInSearch = search.slice(1)
    if ((<Array<string>>availablePhases).includes(phaseInSearch))
      return <EntryPhase>phaseInSearch
    return activePhase
  })

  const saveDraft = atom(null, (get, set) => {
    const updatedEntry = getDraftEntry()
    set(isSaving, true)
    return client.saveDraft(updatedEntry).catch(() => {
      set(isSaving, false)
    })
  })

  const publishDraft = atom(null, (get, set) => {
    const updatedEntry = getDraftEntry()
    set(isPublishing, true)
    return client.publishDrafts([updatedEntry]).catch(() => {
      set(isPublishing, false)
    })
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
    activeTitle,
    states,
    hasChanges,
    saveDraft,
    publishDraft,
    resetDraft,
    isSaving,
    isPublishing
  }
}

function parseYDoc(type: Type, doc: Y.Doc) {
  const docRoot = doc.getMap(ROOT_KEY)
  const data: Record<string, any> = Type.shape(type).fromY(docRoot)
  return {
    path: data.path,
    title: data.title,
    data
  }
}

function createYDoc(config: Config, version: Page) {
  const doc = new Y.Doc()
  const clientID = doc.clientID
  doc.clientID = 1
  const type = config.schema[version.type]
  const docRoot = doc.getMap(ROOT_KEY)
  for (const [key, field] of entries(type)) {
    const contents = version.data[key]
    docRoot.set(key, Field.shape(field).toY(contents))
  }
  doc.clientID = clientID
  return doc
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
