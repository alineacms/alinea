import {Config, EntryPhase, Field, ROOT_KEY, Type} from 'alinea/core'
import {Page} from 'alinea/core/pages/Page'
import {entries, fromEntries, values} from 'alinea/core/util/Objects'
import {InputState} from 'alinea/editor'
import {atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import * as Y from 'yjs'
import {configAtom} from './DashboardAtoms.js'
import {dbAtom, entryRevisionAtoms} from './EntryAtoms.js'
import {locationAtom} from './LocationAtoms.js'

export enum EditMode {
  Editing = 'editing',
  Diff = 'diff'
}

export type Version = Page & {parents: Array<string>}

export const entryEditorAtoms = atomFamily((entryId: string) => {
  return atom(async get => {
    const config = get(configAtom)
    const db = await get(dbAtom)
    get(entryRevisionAtoms(entryId))
    const versions = await db.find(
      Page({entryId}).select({
        ...Page,
        parents({parents}) {
          return parents(Page).select(Page.entryId)
        }
      })
    )
    if (versions.length === 0) return undefined
    const phases = fromEntries(
      versions.map(version => [version.phase, version])
    ) as Record<EntryPhase, Version>
    const availablePhases = values(EntryPhase).filter(
      phase => phases[phase] !== undefined
    )
    return createEntryEditor({
      entryId,
      versions,
      phases,
      availablePhases,
      config
    })
  })
})

export interface EntryData {
  entryId: string
  versions: Array<Version>
  config: Config
  phases: Record<EntryPhase, Version>
  availablePhases: Array<EntryPhase>
}

export type EntryEditor = ReturnType<typeof createEntryEditor>

export function createEntryEditor(entryData: EntryData) {
  const {config, availablePhases} = entryData
  const activePhase = availablePhases[0]
  const version = entryData.phases[activePhase]
  const type = config.schema[version.type]
  const docs = fromEntries(
    entries(entryData.phases).map(([phase, version]) => [
      phase,
      createYDoc(config, version)
    ])
  )
  const hasChanges = createChangesAtom(docs[activePhase])
  const states = fromEntries(
    entries(docs).map(([phase, doc]) => [
      phase,
      new InputState.YDocState(Type.shape(type), doc.getMap(ROOT_KEY), '')
    ])
  )
  const draftState = states[activePhase]
  const editMode = atom(EditMode.Editing)
  const selectedPhase = atom(get => {
    const {search} = get(locationAtom)
    const phaseInSearch = search.slice(1)
    if ((<Array<string>>availablePhases).includes(phaseInSearch))
      return <EntryPhase>phaseInSearch
    return activePhase
  })
  return {
    ...entryData,
    activePhase,
    selectedPhase,
    entryData,
    editMode,
    version,
    type,
    draftState,
    states,
    hasChanges
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
      yDoc.on('update', listener)
    }
    yDoc.on('update', listener)
    return cancel
    function listener() {
      setAtom(true)
      cancel()
    }
  }
  return hasChanges
}
