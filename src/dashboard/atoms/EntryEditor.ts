import {EntryPhase, Field, ROOT_KEY, Type} from 'alinea/core'
import {Page} from 'alinea/core/pages/Page'
import {entries} from 'alinea/core/util/Objects'
import {InputState} from 'alinea/editor'
import {Atom, atom} from 'jotai'
import {atomFamily} from 'jotai/utils'
import * as Y from 'yjs'
import {configAtom} from './DashboardAtoms.js'
import {dbAtom} from './EntryAtoms.js'

export enum EditMode {
  Editing = 'editing',
  Diff = 'diff'
}

// Suspend if we have no data, but keep previous data while loading new data
function keepPreviousData<Value, T extends Atom<Promise<Value>>>(
  asynAtom: T
): T {
  const currentAtom = atom<Value | undefined>(undefined)
  return atom(
    (get, {setSelf}) => {
      const next = get(asynAtom)
      const current = get(currentAtom)
      const promised = next.then(value => {
        setSelf(value)
        return value
      })
      return current ?? promised
    },
    (get, set, value: Value) => {
      set(currentAtom, value)
    }
  ) as any
}

export class EntryVersionEditor {
  constructor(public editor: EntryEditor, public phase: EntryPhase) {}

  version = atom(async get => {
    const versions = await get(this.editor.versions)
    const version = versions.find(v => v.phase === this.phase)
    if (!version) throw new Error(`Could not find ${this.phase} version`)
    return version
  })

  type = atom(async get => {
    const config = get(configAtom)
    const version = await get(this.version)
    return config.schema[version.type]
  })

  yDoc = atom(async get => {
    const config = get(configAtom)
    const version = await get(this.version)
    const doc = new Y.Doc()
    doc.clientID = 1
    const type = config.schema[version.type]
    const docRoot = doc.getMap(ROOT_KEY)
    for (const [key, field] of entries(type)) {
      const contents = version.data[key]
      docRoot.set(key, Field.shape(field).toY(contents))
    }
    return doc
  })

  state = atom(async get => {
    const yDoc = await get(this.yDoc)
    const type = await get(this.type)
    const shape = Type.shape(type)
    const data = yDoc.getMap(ROOT_KEY)
    return new InputState.YDocState(shape, data, '')
  })
}

export class EntryEditor {
  constructor(public entryId: string) {}

  private revision = atom(0)
  private db = atom(get => {
    get(this.revision)
    return get(dbAtom)
  })

  editMode = atom(EditMode.Editing)

  refresh = atom(null, (get, set) => {
    set(this.revision, i => i + 1)
  })

  versions = keepPreviousData(
    atom(async get => {
      const db = await get(this.db)
      return db.find(Page({entryId: this.entryId}))
    })
  )

  selectedPhase = atom<EntryPhase | undefined>(undefined)

  phases = atom(async get => {
    const versions = await get(this.versions)
    return versions.map(v => v.phase)
  })

  versionEditor = atomFamily((phase: EntryPhase) => {
    return atom(new EntryVersionEditor(this, phase))
  })
}
