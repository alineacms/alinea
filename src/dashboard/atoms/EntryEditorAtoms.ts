import {Media} from 'alinea/backend'
import {Config} from 'alinea/core/Config'
import {Connection} from 'alinea/core/Connection'
import {ROOT_KEY, createYDoc, parseYDoc} from 'alinea/core/Doc'
import {Entry} from 'alinea/core/Entry'
import {EntryPhase, EntryRow} from 'alinea/core/EntryRow'
import {Field} from 'alinea/core/Field'
import {Graph} from 'alinea/core/Graph'
import {createId} from 'alinea/core/Id'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {Root} from 'alinea/core/Root'
import {EntryUrlMeta, Type} from 'alinea/core/Type'
import {Workspace} from 'alinea/core/Workspace'
import type {MediaFile} from 'alinea/core/media/MediaTypes'
import {base64} from 'alinea/core/util/Encoding'
import {
  entryFileName,
  entryFilepath,
  entryInfo,
  entryUrl
} from 'alinea/core/util/EntryFilenames'
import {createEntryRow} from 'alinea/core/util/EntryRows'
import {entries, fromEntries, values} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {FormAtoms} from 'alinea/dashboard/atoms/FormAtoms'
import {keepPreviousData} from 'alinea/dashboard/util/KeepPreviousData'
import {atom} from 'jotai'
import {atomFamily, unwrap} from 'jotai/utils'
import {debounceAtom} from '../util/DebounceAtom.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {entryRevisionAtoms, graphAtom, mutateAtom} from './DbAtoms.js'
import {Edits, entryEditsAtoms} from './Edits.js'
import {errorAtom} from './ErrorAtoms.js'
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
  locale: string | null
  i18nId: string | undefined
}

export enum EntryTransition {
  SaveDraft,
  SaveTranslation,
  PublishEdits,
  RestoreRevision,
  PublishDraft,
  DiscardDraft,
  ArchivePublished,
  PublishArchived,
  DeleteFile,
  DeleteArchived
}

const entryTransitionAtoms = atomFamily((entryId: string) => {
  return atom<{transition: EntryTransition; done: Promise<any>} | undefined>(
    undefined
  )
})

export const entryEditorAtoms = atomFamily(
  ({locale, i18nId}: EntryEditorParams) => {
    return atom(async get => {
      if (!i18nId) return undefined
      const config = get(configAtom)
      const client = get(clientAtom)
      const graph = await get(graphAtom)
      const search = locale ? {i18nId, locale} : {i18nId}
      let entry: EntryRow | null = await graph.preferDraft.maybeGet(
        Entry(search)
      )
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
      get(entryRevisionAtoms(entry.i18nId))

      const type = config.schema[entry.type]
      const edits = get(entryEditsAtoms(entryId))

      const loadDraft = client
        .getDraft(entryId)
        .then(draft => {
          if (draft) {
            edits.applyRemoteUpdate(draft.draft)
            // The draft is out of sync, this can happen if
            // - updates done manually to the content files
            // - the draft storage could not be reached after mutation
            // We fast forward the draft with the actual current field data
            // and will submit new updates including it
            const matches = draft.fileHash === entry!.fileHash
            const isEmpty = !edits.hasData()
            if (!matches || isEmpty) {
              edits.applyEntryData(type, entry!.data)
            }
          } else {
            edits.applyEntryData(type, entry!.data)
          }
        })
        .catch(() => {
          edits.applyEntryData(type, entry!.data)
        })

      if (!edits.hasData()) await loadDraft

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
        parents,
        translations,
        parentNeedsTranslation,
        previewToken,
        client,
        config,
        entryId,
        versions,
        phases,
        availablePhases,
        edits
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
  parentNeedsTranslation: boolean
  previewToken: string
  edits: Edits
}

export type EntryEditor = ReturnType<typeof createEntryEditor>

const showHistoryAtom = atom(false)

export function createEntryEditor(entryData: EntryData) {
  const {config, availablePhases, edits} = entryData
  const activePhase = availablePhases[0]
  const activeVersion = entryData.phases[activePhase]
  const type = config.schema[activeVersion.type]
  const docs = fromEntries(
    entries(entryData.phases).map(([phase, version]) => [
      phase,
      createYDoc(type, version)
    ])
  )
  const yDoc = edits.doc
  const hasChanges = edits.hasChanges
  const draftEntry = keepPreviousData(
    yAtom(edits.doc.getMap(ROOT_KEY), getDraftEntry)
  )
  const editMode = atom(EditMode.Editing)
  const view = Type.meta(type).view
  const previewRevision = atom(
    undefined as {ref: string; file: string} | undefined
  )
  const showHistory = atom(
    get => get(showHistoryAtom),
    (get, set, value: boolean) => {
      set(showHistoryAtom, value)
      if (!value) set(previewRevision, undefined)
    }
  )

  const transition = entryTransitionAtoms(activeVersion.entryId)

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

  const transact = atom(
    null,
    async (
      get,
      set,
      options: {
        clearChanges?: boolean
        transition: EntryTransition
        errorMessage: string
        action: () => Promise<void>
      }
    ) => {
      const currentTransition = get(transition)
      if (currentTransition) await currentTransition.done
      const currentChanges = get(hasChanges)
      if (options.clearChanges) set(hasChanges, false)
      const done = options
        .action()
        .catch(error => {
          if (options.clearChanges) set(hasChanges, currentChanges)
          set(errorAtom, options.errorMessage, error)
        })
        .finally(() => {
          //clearTimeout(timeout)
          set(transition, undefined)
        })
      //const timeout = setTimeout(() => {
      set(transition, {transition: options.transition, done})
      //}, 250)
      return done
    }
  )

  const saveDraft = atom(null, async (get, set) => {
    const update = base64.stringify(edits.getLocalUpdate())
    // Use the existing path, when the entry gets published the path will change
    const entry = await getDraftEntry({
      phase: EntryPhase.Published,
      path: activeVersion.path
    })
    const mutation: Mutation = {
      type: MutationType.Edit,
      previousFile: entryFile(activeVersion),
      file: entryFile(entry),
      entryId: activeVersion.entryId,
      entry,
      update
    }
    return set(transact, {
      clearChanges: true,
      transition: EntryTransition.SaveDraft,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete save action, please try again later'
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
    const parentPaths = parentData?.paths
      ? parentData.paths.concat(parentData.path)
      : []
    const entryId = createId()
    const entry = await getDraftEntry({
      entryId,
      phase: EntryPhase.Published,
      parent: parentData?.entryId,
      parentPaths,
      locale
    })
    const mutation: Mutation = {
      type: MutationType.Create,
      file: entryFile(entry, parentPaths),
      entryId,
      entry
    }
    return set(transact, {
      clearChanges: true,
      transition: EntryTransition.SaveTranslation,
      action: () => set(mutateAtom, [mutation]),
      errorMessage:
        'Could not complete translate action, please try again later'
    })
  })

  async function persistSharedFields(
    graph: Graph,
    entry: EntryRow
  ): Promise<Array<Mutation>> {
    const res: Array<Mutation> = []
    const {i18n} = Root.data(config.workspaces[entry.workspace][entry.root])
    if (i18n) {
      const shared = Type.sharedData(type, entry.data)
      if (shared) {
        const translations = await graph.preferPublished.find(
          Entry({i18nId: entry.i18nId})
        )
        for (const translation of translations) {
          if (translation.locale === entry.locale) continue
          res.push({
            type: MutationType.Patch,
            file: entryFile(translation),
            entryId: translation.entryId,
            patch: shared
          })
        }
      }
    }
    return res
  }

  const errorsAtom = atom(get => {
    return get(get(form).errors)
  })

  const confirmErrorsAtom = atom(null, get => {
    const errors = get(errorsAtom)
    if (errors.size > 0) {
      let errorMessage = ''
      for (const [path, {field, error}] of errors.entries()) {
        const label = Field.label(field)
        const line = typeof error === 'string' ? `${label}: ${error}` : label
        errorMessage += `\n— ${line}`
      }
      const message = `These fields contains errors, are you sure you want to publish?${errorMessage}`
      return confirm(message)
    }
    return true
  })

  const publishEdits = atom(null, async (get, set) => {
    if (!set(confirmErrorsAtom)) return
    const currentFile = entryFile(activeVersion)
    const update = base64.stringify(edits.getLocalUpdate())
    const entry = await getDraftEntry({phase: EntryPhase.Published})
    const mutations: Array<Mutation> = []
    const editedFile = entryFile(entry)
    mutations.push({
      type: MutationType.Edit,
      previousFile: currentFile,
      file: editedFile,
      entryId: activeVersion.entryId,
      entry,
      update
    })
    const graph = await get(graphAtom)
    mutations.push(...(await persistSharedFields(graph, entry)))
    return set(transact, {
      clearChanges: true,
      transition: EntryTransition.PublishEdits,
      action: () => set(mutateAtom, mutations),
      errorMessage: 'Could not complete publish action, please try again later'
    })
  })

  const restoreRevision = atom(null, async (get, set) => {
    const revision = get(previewRevision)
    if (!revision) return
    const data = await get(revisionData(revision))
    const {edits} = entryData
    edits.applyEntryData(type, data)
    const update = base64.stringify(edits.getLocalUpdate())
    // We're not restoring the previous path because that is unavailable
    const entry = await getDraftEntry({
      phase: EntryPhase.Published,
      path: activeVersion.path
    })
    const editedFile = entryFile(entry)
    const mutation: Mutation = {
      type: MutationType.Edit,
      previousFile: editedFile,
      file: editedFile,
      entryId: activeVersion.entryId,
      entry,
      update
    }
    return set(transact, {
      clearChanges: true,
      transition: EntryTransition.RestoreRevision,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete publish action, please try again later'
    })
  })

  const publishDraft = atom(null, async (get, set) => {
    if (!set(confirmErrorsAtom)) return
    const mutations: Array<Mutation> = [
      {
        type: MutationType.Publish,
        phase: EntryPhase.Draft,
        entryId: activeVersion.entryId,
        file: entryFile(activeVersion)
      }
    ]
    const entry = entryData.phases[EntryPhase.Draft]
    const graph = await get(graphAtom)
    mutations.push(...(await persistSharedFields(graph, entry)))
    return set(transact, {
      transition: EntryTransition.PublishDraft,
      action: () => set(mutateAtom, mutations),
      errorMessage: 'Could not complete publish action, please try again later'
    })
  })

  const discardDraft = atom(null, (get, set) => {
    const mutation: Mutation = {
      type: MutationType.Discard,
      entryId: activeVersion.entryId,
      file: entryFile(activeVersion)
    }
    return set(transact, {
      transition: EntryTransition.DiscardDraft,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete discard action, please try again later'
    })
  })

  const archivePublished = atom(null, (get, set) => {
    const published = entryData.phases[EntryPhase.Published]
    const mutation: Mutation = {
      type: MutationType.Archive,
      entryId: published.entryId,
      file: entryFile(published)
    }
    return set(transact, {
      transition: EntryTransition.ArchivePublished,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete archive action, please try again later'
    })
  })

  const publishArchived = atom(null, (get, set) => {
    const archived = entryData.phases[EntryPhase.Archived]
    const mutation: Mutation = {
      type: MutationType.Publish,
      phase: EntryPhase.Archived,
      entryId: archived.entryId,
      file: entryFile(archived)
    }
    return set(transact, {
      transition: EntryTransition.PublishArchived,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete publish action, please try again later'
    })
  })

  const deleteMediaLibrary = atom(null, (get, set) => {
    const result = confirm(
      'Are you sure you want to delete this folder and all the files in?'
    )
    if (!result) return
    const published = entryData.phases[EntryPhase.Published]
    const mutations: Array<Mutation> = [
      {
        type: MutationType.Archive,
        entryId: published.entryId,
        file: entryFile(published)
      },
      {
        type: MutationType.Remove,
        entryId: published.entryId,
        file: entryFile({...published, phase: EntryPhase.Archived})
      }
    ]
    return set(transact, {
      transition: EntryTransition.DeleteArchived,
      action: () => set(mutateAtom, mutations),
      errorMessage: 'Could not complete delete action, please try again later'
    })
  })

  const deleteFile = atom(null, (get, set) => {
    // Prompt for confirmation
    const result = confirm('Are you sure you want to delete this file?')
    if (!result) return
    const published = entryData.phases[EntryPhase.Published]
    const file = published.data as MediaFile
    const mutation: Mutation = {
      type: MutationType.FileRemove,
      entryId: published.entryId,
      workspace: published.workspace,
      location:
        Media.ORIGINAL_LOCATION in file
          ? (file[Media.ORIGINAL_LOCATION] as string)
          : file.location,
      file: entryFile(published),
      replace: false
    }
    return set(transact, {
      transition: EntryTransition.DeleteFile,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete delete action, please try again later'
    })
  })

  const deleteArchived = atom(null, (get, set) => {
    const archived = entryData.phases[EntryPhase.Archived]
    const mutation: Mutation = {
      type: MutationType.Remove,
      entryId: archived.entryId,
      file: entryFile(archived)
    }
    return set(transact, {
      transition: EntryTransition.DeleteArchived,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete delete action, please try again later'
    })
  })

  type DraftEntryOptions = {
    phase?: EntryPhase
    path?: string
    parentPaths?: Array<string>
    locale?: string | null
    entryId?: string
    parent?: string
  }
  async function getDraftEntry(
    options: DraftEntryOptions = {}
  ): Promise<EntryRow> {
    const data = parseYDoc(type, yDoc)
    const phase = options.phase ?? activeVersion.phase
    const locale = options.locale ?? activeVersion.locale
    const path = options.path ?? data.path ?? activeVersion.path
    const entryId = options.entryId ?? activeVersion.entryId
    const parent = options.parent ?? activeVersion.parent
    const parentPaths =
      options.parentPaths ?? entryData.parents.map(p => p.path)
    const draftEntry = {
      ...activeVersion,
      ...data,
      entryId,
      parent,
      locale,
      path,
      phase
    }
    const filePath = entryFilepath(config, draftEntry, parentPaths)
    const parentDir = paths.dirname(filePath)
    const extension = paths.extname(filePath)
    const fileName = paths.basename(filePath, extension)
    const [entryPath] = entryInfo(fileName)
    const childrenDir = paths.join(parentDir, entryPath)
    const urlMeta: EntryUrlMeta = {
      locale,
      path,
      phase,
      parentPaths
    }
    const url = entryUrl(type, urlMeta)
    return createEntryRow(config, {
      ...draftEntry,
      parentDir,
      childrenDir,
      filePath,
      url
    })
  }

  const revisionsAtom = atom(async get => {
    const client = get(clientAtom)
    const file = entryFile(activeVersion)
    const revisions = await client.revisions(file)
    // Sort revisions by date
    revisions.sort((a, b) => b.createdAt - a.createdAt)
    return revisions
  })

  const revisionData = atomFamily(
    (params: {file: string; ref: string}) => {
      return atom(get => {
        const client = get(clientAtom)
        return client.revisionData(params.file, params.ref)
      })
    },
    (a, b) => a.file === b.file && a.ref === b.ref
  )

  const revisionDocState = atomFamily(
    (params: {file: string; ref: string}) => {
      return atom(async get => {
        const data = await get(revisionData(params))
        return createYDoc(type, {...activeVersion, data})
      })
    },
    (a, b) => a.file === b.file && a.ref === b.ref
  )

  const selectedState = atom(get => {
    const selected = get(selectedPhase)
    if (selected === activePhase) return edits.doc
    return docs[selected]
  })
  const activeTitle = yAtom(edits.root, () => edits.root.get('title') as string)

  const revisionState = atom(get => {
    const revision = get(previewRevision)
    return revision ? get(revisionDocState(revision)) : undefined
  })
  const identity = (prev: any) => prev
  const currentDoc = atom(get => {
    return get(unwrap(revisionState, identity)) ?? get(selectedState)
  })
  const form = atom(get => {
    const doc = get(currentDoc)
    const readOnly = doc !== edits.doc ? true : undefined
    return new FormAtoms(type, doc.getMap(ROOT_KEY), '', {readOnly})
  })

  const yUpdate = debounceAtom(edits.yUpdate, 250)

  const discardEdits = edits.resetChanges
  const isLoading = edits.isLoading

  const preview =
    Root.preview(
      config.workspaces[activeVersion.workspace][activeVersion.root]
    ) ??
    Workspace.preview(config.workspaces[activeVersion.workspace]) ??
    config.preview

  return {
    ...entryData,
    transition,
    revisionId: createId(),
    activePhase,
    phaseInUrl,
    selectedPhase,
    entryData,
    editMode,
    activeVersion,
    type,
    yUpdate,
    activeTitle,
    hasChanges,
    draftEntry,
    saveDraft,
    publishEdits,
    restoreRevision,
    publishDraft,
    discardDraft,
    archivePublished,
    publishArchived,
    deleteFile,
    deleteMediaLibrary,
    deleteArchived,
    saveTranslation,
    discardEdits,
    isLoading,
    showHistory,
    revisionsAtom,
    previewRevision,
    preview,
    form,
    view
  }
}
