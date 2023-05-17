import {Config, EntryPhase, Field, ROOT_KEY, Type} from 'alinea/core'
import {Page} from 'alinea/core/pages/Page'
import {entries, fromEntries, values} from 'alinea/core/util/Objects'
import {InputState} from 'alinea/editor'
import {WritableAtom, atom, useAtomValue} from 'jotai'
import {loadable} from 'jotai/utils'
import {useEffect} from 'react'
import * as Y from 'yjs'
import {navMatchers} from '../DashboardNav.js'
import {configAtom} from './DashboardAtoms.js'
import {dbAtom, entryRevisionAtoms} from './EntryAtoms.js'
import {locationAtom, matchAtoms} from './RouterAtoms.js'

export enum EditMode {
  Editing = 'editing',
  Diff = 'diff'
}

type Version = Page & {parents: Array<string>}

const selectedPhaseAtom = atom(
  get => {
    const {search} = get(locationAtom)
    const phaseInSearch = search.slice(1)
    if ((<Array<string>>values(EntryPhase)).includes(phaseInSearch))
      return <EntryPhase>phaseInSearch
    return undefined
  },
  (get, set, phase: EntryPhase) => {
    const {pathname} = get(locationAtom)
    const search = `?${phase}`
    set(locationAtom, `${pathname}${search}`)
  }
)

interface EntryData {
  entryId: string
  versions: Array<Version>
  config: Config
  phases: Record<EntryPhase, Version>
  availablePhases: Array<EntryPhase>
}

const entryDataAtom = atom(async (get): Promise<EntryData | undefined> => {
  const config = get(configAtom)
  const db = await get(dbAtom)
  const match = get(matchAtoms({route: navMatchers.matchEntryId}))
  const entryId = match?.id
  if (!entryId) return undefined
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
  const availablePhases = versions.map(v => v.phase)
  return {entryId, versions, phases, availablePhases, config}
})

interface EditorData {
  entryData: EntryData
  phase: EntryPhase
  revisionId: string
  version: Page & {parents: Array<string>}
}

const editorDataAtom = atom(async (get): Promise<EditorData | undefined> => {
  const entryData = await get(entryDataAtom)
  if (!entryData) return undefined
  const selectedPhase = get(selectedPhaseAtom)
  const phase = selectedPhase || entryData.availablePhases[0]
  const version = entryData.phases[phase]
  if (!version) return undefined
  const revisionId = `${entryData.entryId}:${selectedPhase}:${version.contentHash}`
  return {revisionId, phase, entryData, version}
})

interface EditContext {
  editor?: EntryEditor
  isLoading?: boolean
  editorUpdate?: {
    hasConflict: boolean
    data: EditorData
    accept(): void
    reject(): void
  }
}

const currentEditorAtom = atom<EntryEditor | undefined>(undefined)

export const editContextAtom: WritableAtom<EditContext, [EditorData], void> =
  atom(
    (get, ctx): EditContext => {
      const editor = get(currentEditorAtom)
      const nextEditorLoadable = get(loadable(editorDataAtom))
      const isLoading = nextEditorLoadable.state === 'loading'
      const nextEditorData =
        nextEditorLoadable.state === 'hasData'
          ? nextEditorLoadable.data
          : undefined
      const isSameRevision = editor?.revisionId === nextEditorData?.revisionId
      const hasConflict = Boolean(
        nextEditorData && editor && !isSameRevision && get(editor.isDirty)
      )
      /*
    const hasConflict =
      nextEditorData &&
      currentEditor &&
      !isSameRevision &&
      get(currentEditor.isDirty)
    const editor =
      nextEditorData && !hasConflict && !isSameRevision
        ? ctx.setSelf(nextEditorData)
        : currentEditor*/
      const updateAccepted = nextEditorData?.entryData === editor?.entryData
      const editorUpdate = nextEditorData && {
        hasConflict,
        data: nextEditorData,
        accept() {
          ctx.setSelf(nextEditorData)
        },
        reject() {
          console.log('reject')
        }
      }
      return {
        editor,
        isLoading,
        editorUpdate: updateAccepted ? undefined : editorUpdate
      }
    },
    (get, set, editorData: EditorData) => {
      set(currentEditorAtom, createEntryEditor(editorData))
    }
  )

export function useEditContext() {
  const ctx = useAtomValue(editContextAtom)
  useEffect(() => {
    const {editor, editorUpdate} = ctx
    if (!editor && editorUpdate) editorUpdate.accept()
    if (editorUpdate && !editorUpdate.hasConflict) editorUpdate.accept()
  }, [ctx])
  return ctx
}

export type EntryEditor = ReturnType<typeof createEntryEditor>

function createEntryEditor({
  revisionId,
  phase,
  entryData,
  version
}: EditorData) {
  const {config} = entryData
  const type = config.schema[version.type]
  const yDoc = createYDoc(config, version)
  const data = yDoc.getMap(ROOT_KEY)
  const state = new InputState.YDocState(Type.shape(type), data, '')
  const isDirty = createDirtyAtom(yDoc)
  const editMode = atom(EditMode.Editing)
  return {
    ...entryData,
    entryData,
    editMode,
    revisionId,
    phase,
    version,
    type,
    yDoc,
    state,
    isDirty
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

function createDirtyAtom(yDoc: Y.Doc) {
  const isDirty = atom(false)
  isDirty.onMount = setAtom => {
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
  return isDirty
}

/*
export function createEntryEditor(
  {revisionId, entryData, version}: EditorData,
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
    selectedPhase: atom(
      get => {
        const {search} = get(locationAtom)
        const phaseInSearch = search.slice(1)
        if ((<Array<string>>availablePhases).includes(phaseInSearch))
          return <EntryPhase>phaseInSearch
        return mainPhase
      },
      (get, set, phase: EntryPhase) => {
        const {pathname} = get(locationAtom)
        const search = phase === mainPhase ? '' : `?${phase}`
        set(locationAtom, `${pathname}${search}`)
      }
    ),
    versionEditor(phase: EntryPhase) {
      return createVersionEditor(this, phase)
    }
  }
}

export type EntryVersionEditor = ReturnType<typeof createVersionEditor>

function dirtyAtom(yDoc: Y.Doc) {
  const isDirty = atom(false)
  isDirty.onMount = setAtom => {
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
  return isDirty
}

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
    state,
    isDirty: dirtyAtom(yDoc)
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
*/
