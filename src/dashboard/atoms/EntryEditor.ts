import {Config, EntryPhase, Field, ROOT_KEY, Type} from 'alinea/core'
import {Page} from 'alinea/core/pages/Page'
import {entries, fromEntries, values} from 'alinea/core/util/Objects'
import {InputState} from 'alinea/editor'
import {atom} from 'jotai'
import * as Y from 'yjs'

export enum EditMode {
  Editing = 'editing',
  Diff = 'diff'
}

export type EntryEditor = ReturnType<typeof createEntryEditor>

export function createEntryEditor(
  entryId: string,
  versions: Array<Page & {parents: Array<string>}>,
  config: Config
) {
  const phases = fromEntries(versions.map(v => [v.phase, v]))
  const availablePhases = values(EntryPhase).filter(phase => phases[phase])
  const mainPhase = availablePhases[0]
  const main = phases[mainPhase]
  return {
    entryId,
    config,
    versions,
    availablePhases,
    phases,
    main,
    editMode: atom(EditMode.Editing),
    selectedPhase: atom<EntryPhase>(mainPhase),
    versionEditor(phase: EntryPhase) {
      return createVersionEditor(this, phase)
    }
  }
}

export type EntryVersionEditor = ReturnType<typeof createVersionEditor>

export function createVersionEditor(editor: EntryEditor, phase: EntryPhase) {
  const {config, versions} = editor
  const version = versions.find(v => v.phase === phase)
  if (!version) throw new Error(`Could not find ${phase} version`)
  const type = config.schema[version.type]
  const yDoc = createYDoc(config, version)
  const data = yDoc.getMap(ROOT_KEY)
  const state = new InputState.YDocState(Type.shape(type), data, '')
  return {
    phase,
    version,
    type,
    yDoc,
    state
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
