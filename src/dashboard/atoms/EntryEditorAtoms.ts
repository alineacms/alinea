import {Config} from 'alinea/core/Config'
import {Connection} from 'alinea/core/Connection'
import {createYDoc, DOC_KEY, parseYDoc} from 'alinea/core/Doc'
import {formatDraftKey} from 'alinea/core/Draft'
import {Entry} from 'alinea/core/Entry'
import {EntryRow, EntryStatus} from 'alinea/core/EntryRow'
import {Field} from 'alinea/core/Field'
import {Graph} from 'alinea/core/Graph'
import {createId} from 'alinea/core/Id'
import {getType} from 'alinea/core/Internal'
import {Mutation, MutationType} from 'alinea/core/Mutation'
import {Root} from 'alinea/core/Root'
import {EntryUrlMeta, Type} from 'alinea/core/Type'
import {Workspace} from 'alinea/core/Workspace'
import {MEDIA_LOCATION} from 'alinea/core/media/MediaLocation'
import {type MediaFile} from 'alinea/core/media/MediaTypes'
import {encode} from 'alinea/core/util/BufferToBase64'
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
import {encodePreviewPayload} from 'alinea/preview/PreviewPayload'
import {atom} from 'jotai'
import {atomFamily, unwrap} from 'jotai/utils'
import {debounceAtom} from '../util/DebounceAtom.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {
  dbMetaAtom,
  entryRevisionAtoms,
  graphAtom,
  mutateAtom
} from './DbAtoms.js'
import {Edits, entryEditsAtoms} from './Edits.js'
import {errorAtom} from './ErrorAtoms.js'
import {locationAtom} from './LocationAtoms.js'
import {yAtom} from './YAtom.js'

export enum EditMode {
  Editing = 'editing',
  Diff = 'diff'
}

export type Version = Entry & {parents: Array<string>}

interface EntryEditorParams {
  id: string | undefined
  locale: string | null
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

const entryTransitionAtoms = atomFamily((id: string) => {
  return atom<{transition: EntryTransition; done: Promise<any>} | undefined>(
    undefined
  )
})

export const entryEditorAtoms = atomFamily(
  ({id, locale: searchLocale}: EntryEditorParams) => {
    return atom(async get => {
      if (!id) return undefined
      const config = get(configAtom)
      const client = get(clientAtom)
      const graph = await get(graphAtom)
      let entry: EntryRow | null = await graph.first({
        select: Entry,
        id,
        locale: searchLocale,
        status: 'preferDraft'
      })
      if (!entry) {
        const {searchParams} = get(locationAtom)
        const preferredLanguage = searchParams.get('from')
        entry = await graph.first({
          select: Entry,
          locale: preferredLanguage ?? undefined,
          id: id,
          status: 'preferDraft'
        })
      }
      if (!entry) return undefined
      const entryId = entry.id
      const locale = entry.locale
      get(entryRevisionAtoms(entry.id))
      const type = config.schema[entry.type]
      const edits = get(
        entryEditsAtoms({
          id: entry.id,
          locale: entry.locale
        })
      )
      const key = formatDraftKey(entry)
      const loadDraft = client
        .getDraft(key)
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

      const versions = await graph.find({
        select: {
          ...Entry,
          parents: {
            parents: {},
            select: Entry.id
          }
        },
        locale,
        id: entryId,
        status: 'all'
      })
      const withParents = await graph.first({
        select: {
          parents: {
            parents: {},
            select: {
              id: Entry.id,
              path: Entry.path,
              status: Entry.status
            }
          }
        },
        id: entryId,
        locale,
        status: 'preferDraft'
      })
      const translations = (await graph.find({
        select: {
          locale: Entry.locale,
          entryId: Entry.id
        },
        id: entryId,
        filter: {
          _locale: {isNot: locale}
        },
        status: 'preferDraft'
      })) as Array<{locale: string; entryId: string}>
      const parentLink =
        entry.parentId &&
        (await graph.first({
          select: Entry.id,
          id: entry.parentId,
          locale: searchLocale,
          status: 'preferDraft'
        }))
      const untranslated = Boolean(
        entry.locale && searchLocale !== entry.locale
      )
      const parentNeedsTranslation = entry.parentId ? !parentLink : false
      const parents = withParents?.parents ?? []
      const canPublish = parents.every(
        parent => parent.status === EntryStatus.Published
      )
      if (versions.length === 0) return undefined
      const statuses = fromEntries(
        versions.map(version => [version.status, version])
      ) as Record<EntryStatus, Version>
      const availableStatuses = values(EntryStatus).filter(
        status => statuses[status] !== undefined
      )
      return createEntryEditor({
        parents,
        canPublish,
        translations,
        untranslated,
        parentNeedsTranslation,
        client,
        config,
        entryId,
        versions,
        statuses: statuses,
        availableStatuses: availableStatuses,
        edits
      })
    })
  },
  (a, b) => a.locale === b.locale && a.id === b.id
)

export interface EntryData {
  parents: Array<{id: string; path: string; status: EntryStatus}>
  client: Connection
  config: Config
  entryId: string
  versions: Array<Version>
  statuses: Record<EntryStatus, Version>
  availableStatuses: Array<EntryStatus>
  translations: Array<{locale: string; entryId: string}>
  untranslated: boolean
  canPublish: boolean
  parentNeedsTranslation: boolean
  edits: Edits
}

export type EntryEditor = ReturnType<typeof createEntryEditor>

const showHistoryAtom = atom(false)

export function createEntryEditor(entryData: EntryData) {
  const {config, availableStatuses, edits} = entryData
  const activeStatus = availableStatuses[0]
  const activeVersion = entryData.statuses[activeStatus]
  const type = config.schema[activeVersion.type]
  const docs = fromEntries(
    entries(entryData.statuses).map(([status, version]) => [
      status,
      createYDoc(type, version)
    ])
  )
  const yDoc = edits.doc
  const hasChanges = edits.hasChanges
  const draftEntry = keepPreviousData(
    yAtom(edits.doc.getMap(DOC_KEY), getDraftEntry)
  )
  const editMode = atom(EditMode.Editing)
  const view = getType(type).view
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

  const transition = entryTransitionAtoms(activeVersion.id)

  const statusInUrl = atom(get => {
    const {search} = get(locationAtom)
    const statusInSearch = search.slice(1)
    if ((<Array<string>>availableStatuses).includes(statusInSearch))
      return <EntryStatus>statusInSearch
    return undefined
  })

  const selectedStatus = atom(get => {
    return get(statusInUrl) ?? activeStatus
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
    const update = await encode(edits.getLocalUpdate())
    // Use the existing path, when the entry gets published the path will change
    const entry = await getDraftEntry({
      status: EntryStatus.Published,
      path: activeVersion.path
    })
    const mutation: Mutation = {
      type: MutationType.Edit,
      locale: activeVersion.locale,
      previousFile: entryFile(activeVersion),
      file: entryFile(entry),
      entryId: activeVersion.id,
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
    const graph = await get(graphAtom)
    const parentLink =
      activeVersion.parentId &&
      (await graph.get({
        select: Entry.id,
        locale,
        id: activeVersion.parentId,
        status: 'preferDraft'
      }))
    if (activeVersion.parentId && !parentLink)
      throw new Error('Parent not found')
    const parentData = parentLink
      ? await graph.get({
          select: {
            entryId: Entry.id,
            path: Entry.path,
            paths: {
              parents: {},
              select: Entry.path
            }
          },
          id: parentLink,
          locale,
          status: 'preferDraft'
        })
      : undefined
    if (activeVersion.parentId && !parentData)
      throw new Error('Parent not translated')
    const parentPaths = parentData?.paths
      ? parentData.paths.concat(parentData.path)
      : []
    const entry = await getDraftEntry({
      id: activeVersion.id,
      status: EntryStatus.Published,
      parent: parentData?.entryId,
      parentPaths,
      locale
    })
    const mutation: Mutation = {
      type: MutationType.Create,
      locale: entry.locale,
      file: entryFile(entry, parentPaths),
      entryId: activeVersion.id,
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
        const translations = await graph.find({
          select: {
            ...Entry,
            parentPaths: {
              parents: {},
              select: Entry.path
            }
          },
          id: entry.id,
          locale: entry.locale,
          status: 'preferPublished'
        })
        for (const translation of translations) {
          if (translation.locale === entry.locale) continue
          res.push({
            type: MutationType.Patch,
            locale: translation.locale,
            file: entryFile(translation, translation.parentPaths),
            entryId: translation.id,
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
    const update = await encode(edits.getLocalUpdate())
    const entry = await getDraftEntry({status: EntryStatus.Published})
    const mutations: Array<Mutation> = []
    const editedFile = entryFile(entry)
    mutations.push({
      type: MutationType.Edit,
      previousFile: currentFile,
      file: editedFile,
      entryId: activeVersion.id,
      locale: entry.locale,
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
    if (!data) return
    const {edits} = entryData
    edits.applyEntryData(type, data)
    const update = await encode(edits.getLocalUpdate())
    // We're not restoring the previous path because that is unavailable
    const entry = await getDraftEntry({
      status: EntryStatus.Published,
      path: activeVersion.path
    })
    const editedFile = entryFile(entry)
    const mutation: Mutation = {
      type: MutationType.Edit,
      previousFile: editedFile,
      file: editedFile,
      entryId: activeVersion.id,
      locale: entry.locale,
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
        status: EntryStatus.Draft,
        entryId: activeVersion.id,
        locale: activeVersion.locale,
        file: entryFile(activeVersion)
      }
    ]
    const entry = entryData.statuses[EntryStatus.Draft]
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
      entryId: activeVersion.id,
      locale: activeVersion.locale,
      file: entryFile(activeVersion)
    }
    return set(transact, {
      transition: EntryTransition.DiscardDraft,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete discard action, please try again later'
    })
  })

  const archivePublished = atom(null, (get, set) => {
    const published = entryData.statuses[EntryStatus.Published]
    const mutation: Mutation = {
      type: MutationType.Archive,
      entryId: published.id,
      locale: published.locale,
      file: entryFile(published)
    }
    return set(transact, {
      transition: EntryTransition.ArchivePublished,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete archive action, please try again later'
    })
  })

  const publishArchived = atom(null, (get, set) => {
    const archived = entryData.statuses[EntryStatus.Archived]
    const mutation: Mutation = {
      type: MutationType.Publish,
      status: EntryStatus.Archived,
      entryId: archived.id,
      locale: archived.locale,
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
      'Are you sure you want to delete this folder and all its files?'
    )
    if (!result) return
    const published = entryData.statuses[EntryStatus.Published]
    const mutations: Array<Mutation> = [
      {
        type: MutationType.Archive,
        entryId: published.id,
        locale: published.locale,
        file: entryFile(published)
      },
      {
        type: MutationType.Remove,
        entryId: published.id,
        locale: published.locale,
        file: entryFile({...published, status: EntryStatus.Archived})
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
    const published = entryData.statuses[EntryStatus.Published]
    const file = published.data as MediaFile
    const mutation: Mutation = {
      type: MutationType.FileRemove,
      entryId: published.id,
      locale: null,
      workspace: published.workspace,
      location:
        MEDIA_LOCATION in file
          ? (file[MEDIA_LOCATION] as string)
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
    const archived = entryData.statuses[EntryStatus.Archived]
    const mutation: Mutation = {
      type: MutationType.Remove,
      entryId: archived.id,
      locale: archived.locale,
      file: entryFile(archived)
    }
    return set(transact, {
      transition: EntryTransition.DeleteArchived,
      action: () => set(mutateAtom, [mutation]),
      errorMessage: 'Could not complete delete action, please try again later'
    })
  })

  type DraftEntryOptions = {
    status?: EntryStatus
    path?: string
    parentPaths?: Array<string>
    locale?: string | null
    id?: string
    parent?: string
  }
  async function getDraftEntry(
    options: DraftEntryOptions = {}
  ): Promise<EntryRow> {
    const data = parseYDoc(type, yDoc)
    const status = options.status ?? activeVersion.status
    const locale = options.locale ?? activeVersion.locale
    const path = options.path ?? data.path ?? activeVersion.path
    const id = options.id ?? activeVersion.id
    const parent = options.parent ?? activeVersion.parentId
    const parentPaths =
      options.parentPaths ?? entryData.parents.map(p => p.path)
    const draftEntry = {
      ...activeVersion,
      ...data,
      id,
      parent,
      locale,
      path,
      status
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
      status,
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
        const entry = data ? {...activeVersion, data} : activeVersion
        return createYDoc(type, entry)
      })
    },
    (a, b) => a.file === b.file && a.ref === b.ref
  )

  const selectedState = atom(get => {
    const selected = get(selectedStatus)
    if (selected === activeStatus) return edits.doc
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
    const readOnly = doc !== edits.doc ? true : !entryData.canPublish
    return new FormAtoms(type, doc.getMap(DOC_KEY), '', {readOnly})
  })

  const yUpdate = debounceAtom(edits.yUpdate, 250)
  const previewPayload = atom(async get => {
    const {contentHash} = await get(dbMetaAtom)
    const update = get(yUpdate)
    const status = get(selectedStatus)
    return encodePreviewPayload({
      locale: activeVersion.locale,
      entryId: activeVersion.id,
      contentHash,
      status: status,
      update
    })
  })

  const discardEdits = edits.resetChanges
  const isLoading = edits.isLoading

  const preview =
    Root.preview(
      config.workspaces[activeVersion.workspace][activeVersion.root]
    ) ??
    Workspace.preview(config.workspaces[activeVersion.workspace]) ??
    config.preview

  const previewToken = atom(async get => {
    const client = get(clientAtom)
    return client.previewToken({
      locale: activeVersion.locale,
      entryId: entryData.entryId
    })
  })

  return {
    ...entryData,
    transition,
    revisionId: createId(),
    activeStatus,
    statusInUrl,
    selectedStatus,
    entryData,
    editMode,
    activeVersion,
    type,
    previewPayload,
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
    previewToken,
    previewRevision,
    preview,
    form,
    view
  }
}
