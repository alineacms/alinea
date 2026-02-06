import type {Config} from 'alinea/core/Config'
import type {Connection} from 'alinea/core/Connection'
import {createYDoc, DOC_KEY, parseYDoc} from 'alinea/core/Doc'
import {Entry, type EntryStatus} from 'alinea/core/Entry'
import {createRecord} from 'alinea/core/EntryRecord'
import {Field} from 'alinea/core/Field'
import {createId} from 'alinea/core/Id'
import {getType} from 'alinea/core/Internal'
import {createFilePatch} from 'alinea/core/source/FilePatch'
import {Root} from 'alinea/core/Root'
import {type EntryUrlMeta, Type} from 'alinea/core/Type'
import {
  entryFileName,
  entryFilepath,
  entryInfo,
  entryUrl
} from 'alinea/core/util/EntryFilenames'
import {createEntryRow} from 'alinea/core/util/EntryRows'
import {entries, fromEntries} from 'alinea/core/util/Objects'
import * as paths from 'alinea/core/util/Paths'
import {Workspace} from 'alinea/core/Workspace'
import {JsonLoader} from 'alinea/backend/loader/JsonLoader'
import {FormAtoms} from 'alinea/dashboard/atoms/FormAtoms'
import {keepPreviousData} from 'alinea/dashboard/util/KeepPreviousData'
import {encodePreviewPayload} from 'alinea/preview/PreviewPayload'
import {atom, type Getter, type Setter} from 'jotai'
import {atomFamily, unwrap} from 'jotai/utils'
import {debounceAtom} from '../util/DebounceAtom.js'
import {clientAtom, configAtom} from './DashboardAtoms.js'
import {dbAtom, dbMetaAtom, entryRevisionAtoms} from './DbAtoms.js'
import {type Edits, entryEditsAtoms} from './Edits.js'
import {errorAtom} from './ErrorAtoms.js'
import {locationAtom} from './LocationAtoms.js'
import {yAtom} from './YAtom.js'
const decoder = new TextDecoder()

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
  UnpublishDraft,
  DiscardDraft,
  ArchivePublished,
  PublishArchived,
  DeleteFile,
  DeleteEntry
}

const entryTransitionAtoms = atomFamily((id: string) => {
  return atom<EntryTransition | undefined>(undefined)
})

export const entryEditorAtoms = atomFamily(
  ({id, locale: searchLocale}: EntryEditorParams) => {
    return atom(async get => {
      if (!id) return undefined
      get(entryRevisionAtoms(id))
      const config = get(configAtom)
      const client = get(clientAtom)
      const graph = get(dbAtom)
      let entry: Entry | null = await graph.first({
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
      const untranslated = Boolean(
        entry.locale && searchLocale !== entry.locale
      )
      const edits = get(
        entryEditsAtoms(
          untranslated
            ? {...entry, data: {...entry.data, path: undefined}}
            : entry
        )
      )

      const versions = await graph.find({
        select: {
          ...Entry,
          parents: {
            edge: 'parents',
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
            edge: 'parents',
            select: {
              id: Entry.id,
              path: Entry.path,
              status: Entry.status,
              main: Entry.main
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
      const parentNeedsTranslation = entry.parentId ? !parentLink : false
      const parents = withParents?.parents ?? []
      const canPublish = parents.every(parent => parent.status === 'published')
      const canDelete = !entry.seeded
      if (versions.length === 0) return undefined
      const statuses = fromEntries(
        versions.map(version => [version.status, version])
      ) as Record<EntryStatus, Version>
      const availableStatuses = Array<EntryStatus>(
        'draft',
        'published',
        'archived'
      ).filter(status => statuses[status] !== undefined)
      return createEntryEditor({
        parents,
        canDelete,
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
  parents: Array<{id: string; path: string; status: EntryStatus; main: boolean}>
  client: Connection
  config: Config
  entryId: string
  versions: Array<Version>
  statuses: Record<EntryStatus, Version>
  availableStatuses: Array<EntryStatus>
  translations: Array<{locale: string; entryId: string}>
  untranslated: boolean
  canPublish: boolean
  canDelete: boolean
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

  function entryFile(entry: Entry, parentPaths?: Array<string>) {
    return entryFileName(
      config,
      entry,
      parentPaths ?? entryData.parents.map(p => p.path)
    )
  }

  type Action = {
    transition: EntryTransition
    result: Promise<unknown>
    errorMessage: string
    clearChanges?: boolean
  }
  const action = atom(
    null,
    (
      get: Getter,
      set: Setter,
      {
        transition: entryTransition,
        result,
        errorMessage,
        clearChanges = false
      }: Action
    ) => {
      const now = Date.now()
      set(transition, entryTransition)
      return result
        .then(async () => {
          if (clearChanges) set(hasChanges, false)
        })
        .catch(error => {
          set(errorAtom, errorMessage, error)
        })
        .finally(() => {
          const duration = Date.now() - now
          const delay = Math.max(0, 500 - duration)
          setTimeout(() => {
            set(transition, undefined)
          }, delay)
        })
    }
  )

  const parent = entryData.parents.at(-1)
  const parentArchived = parent?.status === 'archived'
  const parentUnpublished = parent?.status === 'draft' && parent.main

  const saveDraft = atom(null, async (get, set) => {
    if (parentArchived || parentUnpublished) return set(publishEdits)
    // Use the existing path, when the entry gets published the path will change
    const db = get(dbAtom)
    const entry = await getDraftEntry({
      status: 'published',
      path: activeVersion.path
    })
    return set(action, {
      transition: EntryTransition.SaveDraft,
      result: db.create({
        type,
        id: entry.id,
        locale: entry.locale,
        status: 'draft',
        set: entry.data,
        overwrite: true
      }),
      errorMessage: 'Could not complete draft action, please try again later',
      clearChanges: true
    })
  })

  const saveTranslation = atom(null, async (get, set, locale: string) => {
    const db = get(dbAtom)
    const parentId = activeVersion.parentId
    const parentData = parentId
      ? await db.get({
          select: {
            entryId: Entry.id,
            path: Entry.path,
            paths: {
              edge: 'parents',
              select: Entry.path
            }
          },
          id: parentId,
          locale,
          status: 'preferDraft'
        })
      : undefined
    if (parentId && !parentData) throw new Error('Parent not translated')
    const parentPaths = parentData?.paths
      ? parentData.paths.concat(parentData.path)
      : []
    const entry = await getDraftEntry({
      id: activeVersion.id,
      status: 'published',
      parent: parentData?.entryId,
      parentPaths,
      locale
    })

    return set(action, {
      transition: EntryTransition.SaveTranslation,
      result: db.create({
        type,
        id: entry.id,
        parentId,
        locale,
        status: config.enableDrafts ? 'draft' : 'published',
        set: entry.data
      }),
      errorMessage:
        'Could not complete translate action, please try again later',
      clearChanges: true
    })
  })

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
    const db = get(dbAtom)
    const entry = await getDraftEntry({status: 'published'})
    return set(action, {
      transition: EntryTransition.PublishEdits,
      result: db.create({
        type,
        id: entry.id,
        locale: entry.locale,
        status: 'published',
        set: entry.data,
        overwrite: true
      }),
      errorMessage: 'Could not complete publish action, please try again later',
      clearChanges: true
    })
  })

  const restoreRevision = atom(null, async (get, set) => {
    const revision = get(previewRevision)
    if (!revision) return
    const data = await get(revisionData(revision))
    if (!data) return
    const db = get(dbAtom)
    const {edits} = entryData
    edits.applyEntryData(data)
    const entry = await getDraftEntry({
      status: 'published',
      path: activeVersion.path
    })
    return set(action, {
      transition: EntryTransition.RestoreRevision,
      result: db.update({
        type,
        id: entry.id,
        locale: entry.locale,
        status: 'published',
        set: entry.data
      }),
      errorMessage: 'Could not complete publish action, please try again later',
      clearChanges: true
    })
  })

  const publishDraft = atom(null, async (get, set) => {
    // sync: store update in draft right here
    if (!set(confirmErrorsAtom)) return
    const db = get(dbAtom)
    return set(action, {
      transition: EntryTransition.PublishDraft,
      result: db.publish({
        id: activeVersion.id,
        locale: activeVersion.locale,
        status: 'draft'
      }),
      errorMessage: 'Could not complete publish action, please try again later'
    })
  })

  const discardDraft = atom(null, async (get, set) => {
    const db = get(dbAtom)
    return set(action, {
      transition: EntryTransition.DiscardDraft,
      result: db.discard({
        id: activeVersion.id,
        locale: activeVersion.locale,
        status: 'draft'
      }),
      errorMessage: 'Could not complete discard action, please try again later'
    })
  })

  const unPublish = atom(null, async (get, set) => {
    const db = get(dbAtom)
    return set(action, {
      transition: EntryTransition.UnpublishDraft,
      result: db.unpublish({
        id: activeVersion.id,
        locale: activeVersion.locale
      }),
      errorMessage:
        'Could not complete unpublish action, please try again later'
    })
  })

  const archive = atom(null, async (get, set) => {
    const db = get(dbAtom)
    return set(action, {
      transition: EntryTransition.ArchivePublished,
      result: db.archive({
        id: activeVersion.id,
        locale: activeVersion.locale
      }),
      errorMessage: 'Could not complete archive action, please try again later'
    })
  })

  const publishArchived = atom(null, async (get, set) => {
    const db = get(dbAtom)
    return set(action, {
      transition: EntryTransition.PublishArchived,
      result: db.publish({
        id: activeVersion.id,
        locale: activeVersion.locale,
        status: 'archived'
      }),
      errorMessage: 'Could not complete publish action, please try again later'
    })
  })

  const deleteMediaLibrary = atom(null, async (get, set) => {
    const result = confirm(
      'Are you sure you want to delete this folder and all its files?'
    )
    if (!result) return
    const db = get(dbAtom)
    return set(action, {
      transition: EntryTransition.DeleteEntry,
      result: db.remove(activeVersion.id),
      errorMessage: 'Could not complete delete action, please try again later'
    })
  })

  const deleteFile = atom(null, async (get, set) => {
    // Prompt for confirmation
    const result = confirm('Are you sure you want to delete this file?')
    if (!result) return
    const db = get(dbAtom)
    return set(action, {
      transition: EntryTransition.DeleteFile,
      result: db.remove(activeVersion.id),
      errorMessage: 'Could not complete delete action, please try again later'
    })
  })

  const deleteEntry = atom(null, async (get, set) => {
    const db = get(dbAtom)
    return set(action, {
      transition: EntryTransition.DeleteEntry,
      result: db.remove(activeVersion.id),
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
  ): Promise<Entry> {
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
    return createEntryRow(
      config,
      {
        ...draftEntry,
        parentDir,
        childrenDir,
        filePath,
        url
      },
      status
    )
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
    const readOnly = doc !== edits.doc
    return new FormAtoms(type, doc.getMap(DOC_KEY), '', {readOnly})
  })

  const yUpdate = debounceAtom(edits.yUpdate, 250)
  const previewPayload = atom(async get => {
    const sha = await get(dbMetaAtom)
    get(yUpdate)
    const status = get(selectedStatus)
    const baseText = decoder.decode(
      JsonLoader.format(
        config.schema,
        createRecord(activeVersion, activeVersion.status)
      )
    )
    const updated = await getDraftEntry({status})
    const patch = await createFilePatch(
      baseText,
      decoder.decode(
        JsonLoader.format(config.schema, createRecord(updated, status))
      )
    )
    return encodePreviewPayload({
      locale: activeVersion.locale,
      entryId: activeVersion.id,
      contentHash: sha,
      status: status,
      patch
    })
  })

  const discardEdits = edits.resetChanges

  const preview =
    Type.preview(type) ??
    Root.preview(
      config.workspaces[activeVersion.workspace][activeVersion.root]
    ) ??
    Workspace.preview(config.workspaces[activeVersion.workspace]) ??
    config.preview

  const previewToken = atom(async get => {
    const client = get(clientAtom)
    return client.previewToken({url: activeVersion.url})
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
    unPublish,
    archive,
    publishArchived,
    deleteFile,
    deleteMediaLibrary,
    deleteEntry,
    saveTranslation,
    discardEdits,
    showHistory,
    revisionsAtom,
    previewToken,
    previewRevision,
    preview,
    form,
    view
  }
}
