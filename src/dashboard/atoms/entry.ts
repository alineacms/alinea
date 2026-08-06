import {Config} from '#/core/Config.js'
import type {Revision} from '#/core/Connection.js'
import {UploadOperation} from '#/core/db/Operation.js'
import type {EntryReference} from '#/core/db/EntryReference.js'
import {
  Entry,
  type Entry as EntryRecord,
  type EntryStatus
} from '#/core/Entry.js'
import {parseRecord} from '#/core/EntryRecord.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import {createId} from '#/core/Id.js'
import {getType, getWorkspace} from '#/core/Internal.js'
import {createPreview} from '#/core/media/CreatePreview.browser.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Permission} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {join} from '#/core/util/Paths.js'
import type {Infer} from '#/types.js'
import type {Atom, Getter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {
  configAtom,
  queryTreeChildren,
  type RootAtoms,
  viewsAtom,
  workspaceAtoms
} from './config.js'
import {ReactiveNode} from './entry/editor.js'
import {entryLoaderAtom, MissingEntryError} from './entry/load.js'
import {graphAtom, shaAtom} from './graph.js'
import {uploadProgressAtom} from './graph/queue.js'
import {refreshCurrentRouteAtom, routeAtom} from './routing.js'
import {clientAtom, policyAtom, userAtom} from './user.js'
import {dispense, swr, uploadSizeError, withPending} from './utils.js'
import type {
  DashboardEntryReference,
  DashboardEntryReferences,
  DashboardEntryReferenceSource,
  DashboardEntryTreeStatus,
  DashboardFileInfoState,
  EntryRouteBlock
} from './entry/load.js'
import {
  EntryLanguageAtoms,
  entryRevisionAtom,
  locallyDeletingEntryAtom
} from './entry/load.js'
import {createEntryPreviewAtoms} from './entry/preview.js'

export const entryOverviewColumnCount = 5

export type EntryView = 'edit' | 'overview'

export interface EntryOverviewCell {
  id: string
  field: Field
  label: string
  value: unknown
}

type EntryVersionData = EntryRecord<Record<string, unknown>>

interface EntryData {
  id: string
  type: string
  parentId: string | null
  workspace: string
  root: string
  hasChildren: boolean
  parents: Array<{
    id: string
    index: string
    path: string
    type: string
    status: EntryStatus
    main: boolean
  }>
  entries: Array<EntryVersionData>
}

export interface DashboardEntryState {
  pending: boolean
  data: EntryDataAtoms | undefined
  error: MissingEntryError | undefined
}

type SelectedVersion =
  | {type: 'status'; status: EntryStatus}
  | {type: 'history'; file: string; ref: string}

interface NodeSelection {
  locale: string | null
  untranslated: boolean
  version: SelectedVersion
}

export class EntryAtoms {
  data: Atom<DashboardEntryState>
  readyState: Atom<Promise<DashboardEntryState>>
  #selectedView = atom<EntryView | undefined>(undefined)

  constructor(public id: string) {
    const entryData = atom<Promise<EntryData>>(async get => {
      get(entryRevisionAtom(id))
      return get(this.preload)
    })
    let data: EntryDataAtoms
    const loaded = atom(async get => {
      const initial = await get(entryData)
      return (data ??= new EntryDataAtoms(
        this,
        unwrap(entryData, prev => prev ?? initial) as Atom<EntryData>
      ))
    })
    const state = atom(async get => {
      try {
        return {
          pending: false,
          data: await get(loaded),
          error: undefined
        } satisfies DashboardEntryState
      } catch (error) {
        if (error instanceof MissingEntryError) {
          return {
            pending: false,
            data: undefined,
            error
          } satisfies DashboardEntryState
        }
        throw error
      }
    })
    this.readyState = state
    this.data = unwrap(state, prev => ({
      pending: true,
      data: prev?.data,
      error: prev?.error
    }))
  }

  preload = atom(async get => {
    const load = await get(entryLoaderAtom)
    const [result, error] = await load(this.id)
    if (error) {
      if (error instanceof MissingEntryError) get(shaAtom)
      throw error
    }
    assert(result, `Entry "${this.id}" not found`)
    return result
  })

  view = atom(
    get => get(this.#selectedView),
    (_get, set, view: EntryView | undefined) => {
      set(this.#selectedView, view)
    }
  )
}

function dashboardEntryOverviewFields(type: Type): Array<[string, Field]> {
  return Object.entries(Type.fields(type)).flatMap(([key, field]) => {
    const options = Field.options(field) as FieldOptions<unknown>
    if (options.hidden || options.overview !== true) return []
    if (key === 'title') return []
    return [[key, field]]
  })
}

export class EntryDataAtoms {
  type: Atom<Type>
  overviewCells: Atom<Array<EntryOverviewCell>>
  defaultView: Atom<'edit' | 'overview'>
  view: WritableAtom<EntryView, [view: EntryView], void>
  locales: Atom<Map<string | null, EntryVersionData>>
  root: Atom<RootAtoms>
  #translationSourceLocale = atom<string | null | undefined>(undefined)
  #nodes = new Map<string, Atom<Promise<ReactiveNode<object>>>>()

  #untranslatedFor(get: Getter, locale: string | null) {
    return !get(this.locales).has(locale)
  }

  sourceLocaleFor(get: Getter, locale: string | null) {
    if (this.#untranslatedFor(get, locale))
      return get(this.translationSourceLocale)
    return locale
  }

  #selectedVersionFor(get: Getter, locale: string | null): SelectedVersion {
    const selected = get(this.#selection)
    if (selected) return selected
    const sourceLocale = this.sourceLocaleFor(get, locale)
    const entry = get(this.locales).get(sourceLocale)
    assert(entry, `Entry ${this.id} has no data for locale ${sourceLocale}`)
    return {type: 'status', status: entry.status}
  }

  currentEntryFor = dispense((locale: string | null) =>
    swr(
      atom(async (get): Promise<Entry | null> => {
        const sourceLocale = this.sourceLocaleFor(get, locale)
        const selected = get(this.#selection)
        if (!selected) return get(this.locales).get(sourceLocale) ?? null
        const language = this.languages(sourceLocale)
        const versions = await get(language.versionsResource)
        const fallback = versions.values().next().value ?? null
        if (selected.type === 'status') {
          return versions.get(selected.status) ?? fallback
        }
        const activeVersion = await get(language.activeVersionResource)
        const data = await get(this.historyData(historyDataKey(selected)))
        if (!data) return activeVersion
        const parsedData = parseRecord(data).data
        return {
          ...activeVersion,
          title:
            typeof parsedData.title === 'string'
              ? parsedData.title
              : activeVersion.title,
          path:
            typeof parsedData.path === 'string'
              ? parsedData.path
              : activeVersion.path,
          data: parsedData
        }
      })
    )
  )

  currentEntry = atom(get => {
    const root = get(this.root)
    return get(this.currentEntryFor(get(root.selectedLocale)))
  })

  customView = atom(get => {
    const type = get(this.type)
    const {view} = getType(type)
    if (typeof view === 'string') return get(viewsAtom)[view]
    return view
  })

  constructor(
    public entry: EntryAtoms,
    public entryData: Atom<EntryData>
  ) {
    const data = this.entryData
    this.type = atom(get => {
      const key = get(data).type
      const type = get(configAtom).schema[key]
      assert(type, `Type "${key}" not found in config`)
      return type
    })
    this.defaultView = atom(get => {
      if (get(data).hasChildren) return 'overview'
      const configured = Type.defaultView(get(this.type))
      if (configured) return configured
      return 'edit'
    })
    this.view = atom(
      get => {
        const selected = get(this.entry.view)
        if (selected) return selected
        return get(this.defaultView)
      },
      (get, set, view: EntryView) => {
        return set(this.entry.view, view)
      }
    )
    this.locales = atom(
      get =>
        new Map(
          get(data).entries.map(entry => {
            return [entry.locale, entry] as const
          })
        )
    )
    this.root = atom(get => {
      const {workspace, root} = get(data)
      return workspaceAtoms(workspace).root(root)
    })
    this.overviewCells = atom(get => {
      const entry = get(this.currentEntry)
      if (!entry || entry instanceof Promise) return []
      const type = get(this.type)
      return dashboardEntryOverviewFields(type)
        .slice(0, entryOverviewColumnCount)
        .map(([key, field]) => {
          return {
            id: key,
            field,
            label: Field.label(field),
            value: entry.data[key]
          }
        })
    })
  }

  get id() {
    return this.entry.id
  }

  translationSourceLocales = atom(get => {
    return Array.from(get(this.locales).keys()).filter(
      (locale): locale is string => locale !== null
    )
  })

  translationSourceLocale = atom(
    get => {
      const locale = get(this.#translationSourceLocale)
      const available = get(this.translationSourceLocales)
      if (locale && available.includes(locale)) return locale
      return available[0] ?? null
    },
    (get, set, locale: string) => {
      if (get(this.#translationSourceLocale) === locale) return
      const localized = get(this.locales).get(locale)
      assert(localized, `Entry ${this.id} has no data for locale ${locale}`)
      set(this.#translationSourceLocale, locale)
      set(this.currentlyEditing, undefined)
      set(this.#selection, undefined)
    }
  )

  sourceLocale = atom(get => {
    const root = get(this.root)
    return this.sourceLocaleFor(get, get(root.selectedLocale))
  })

  activeStatus = atom(get => {
    const locales = get(this.locales)
    const locale = get(this.sourceLocale)
    const entry = locales.get(locale)
    assert(entry, `Entry ${this.id} has no data for locale ${locale}`)
    return entry.status
  })

  #selection = atom<SelectedVersion>()
  selectedVersion = atom(
    (get): SelectedVersion => {
      const root = get(this.root)
      return this.#selectedVersionFor(get, get(root.selectedLocale))
    },
    (_get, set, next: SelectedVersion) => {
      set(this.#selection, next)
    }
  )

  historyFor = dispense((locale: string | null) =>
    atom(async (get): Promise<Array<Revision>> => {
      const config = get(configAtom)
      const sourceLocale = this.sourceLocaleFor(get, locale)
      const data = get(this.locales).get(sourceLocale)
      assert(data, `No locale data found for locale ${sourceLocale}`)
      const file = dashboardEntryFile(config, {
        workspace: get(this.entryData).workspace,
        root: get(this.entryData).root,
        filePath: data.filePath
      })
      const client = get(clientAtom)
      const revisions = await client.revisions(file)
      return revisions.slice(1)
    })
  )

  historyData = dispense((key: string) => {
    return atom(async get => {
      const [ref, file] = parseHistoryDataKey(key)
      const client = get(clientAtom)
      return client.revisionData(file, ref)
    })
  })

  #node(selection: NodeSelection): Atom<Promise<ReactiveNode<object>>> {
    const key = JSON.stringify(selection)
    const cached = this.#nodes.get(key)
    if (cached) return cached
    const selected = atom(async (get): Promise<ReactiveNode<object>> => {
      const {locale, untranslated, version} = selection
      const localized = get(this.locales).get(locale)
      assert(localized, `Entry ${this.id} has no data for locale ${locale}`)
      if (version.type === 'status') {
        const language = this.languages(locale)
        const versions = await get(language.versionsResource)
        const status = versions.has(version.status)
          ? version.status
          : versions.keys().next().value
        assert(
          status,
          `No versions found for entry ${this.id} and locale ${locale}`
        )
        if (untranslated) {
          const sourceNode = await get(language.data(status))
          const sourceValue = get(sourceNode.value) as Record<string, unknown>
          return new ReactiveNode<object>({
            ...sourceValue,
            path: undefined
          })
        }
        return get(language.data(status))
      }
      const language = this.languages(locale)
      const activeVersion = await get(language.activeVersionResource)
      const data = await get(this.historyData(historyDataKey(version)))
      const type = get(this.type)
      const historyData = data ? parseRecord(data).data : activeVersion.data
      return new ReactiveNode<object>(
        Type.withInitialValue(type, {
          ...Type.initialValue(type),
          ...historyData,
          title:
            typeof historyData.title === 'string'
              ? historyData.title
              : activeVersion.title,
          path:
            typeof historyData.path === 'string'
              ? historyData.path
              : activeVersion.path
        }),
        true
      )
    })
    this.#nodes.set(key, selected)
    return selected
  }

  selectedNodeFor = dispense((locale: string | null) =>
    atom(async get => {
      const version = this.#selectedVersionFor(get, locale)
      const sourceLocale = this.sourceLocaleFor(get, locale)
      if (version.type === 'status') {
        const editing = get(this.currentlyEditing)
        const active = get(this.locales).get(sourceLocale)
        if (editing && active && version.status === active.status)
          return editing
      }
      return get(
        this.#node({
          locale: sourceLocale,
          untranslated: this.#untranslatedFor(get, locale),
          version
        })
      )
    })
  )

  selectedNode = swr(
    atom(async get => {
      const root = get(this.root)
      return get(this.selectedNodeFor(get(root.selectedLocale)))
    })
  )

  label = atom(get => {
    const locale = get(this.sourceLocale)
    const locales = get(this.locales)
    const entry = locales.get(locale)
    if (entry?.title) return entry.title
    for (const fallback of locales.values()) {
      if (fallback.title) return fallback.title
    }
    return ''
  })

  treeStatus = atom((get): DashboardEntryTreeStatus => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    const locales = get(this.locales)
    const localized = locales.get(locale)
    const fallback = locales.values().next().value
    const entry = localized ?? fallback
    assert(entry, `Entry ${this.id} has no versions`)
    if (localized === undefined) return {status: 'untranslated'}
    if (entry.status === 'draft' && entry.main === true)
      return {status: 'unpublished'}
    return {
      status: entry.status
    }
  })

  fileInfo = swr(
    atom(async (get): Promise<Infer<typeof MediaFile> | null> => {
      if (get(this.type) !== MediaFile) return null
      const lang = this.languages(null)
      const data = await get(lang.activeVersion)
      return data.data as Infer<typeof MediaFile>
    })
  )

  #fileInfoState = withPending(this.fileInfo)
  fileInfoState: Atom<DashboardFileInfoState> = atom(get => {
    const [pending, data] = get(this.#fileInfoState)
    return {pending, data}
  })

  #parents = atom(async get => {
    const parentIds = get(this.entryData).parents.map(parent => parent.id)
    return Promise.all(
      parentIds.map(async id => {
        const parent = entryAtoms(id)
        assert(parent, `Parent entry not found: ${id}`)
        return parent
      })
    )
  })

  parentsState = withPending(this.#parents)

  parents = unwrap(this.#parents, prev => prev ?? [])

  incomingReferencesResource = atom(async get => {
    get(entryRevisionAtom(this.id))
    const db = get(graphAtom)
    const policy = get(policyAtom)
    const result = await db.referencesTo({
      targetId: this.id,
      status: 'preferDraft'
    })
    const sourceIds = Array.from(
      new Set(result.references.map(reference => reference.sourceId))
    )
    const sources =
      sourceIds.length > 0
        ? await db.find({
            id: {in: sourceIds},
            status: 'preferDraft',
            select: {
              id: Entry.id,
              title: Entry.title,
              type: Entry.type,
              workspace: Entry.workspace,
              root: Entry.root,
              locale: Entry.locale,
              status: Entry.status,
              path: Entry.path,
              url: Entry.url
            }
          })
        : []
    const sourceByLocale = new Map(
      sources.map(source => [entryReferenceSourceKey(source), source] as const)
    )
    const sourceById = new Map(sources.map(source => [source.id, source]))
    const references = result.references.flatMap(reference => {
      const source =
        sourceByLocale.get(entryReferenceKey(reference)) ??
        sourceById.get(reference.sourceId)
      if (!source || !policy.canRead(source)) return []
      return [{reference, source}]
    })
    return {
      references,
      total: result.total,
      scan: result.scan
    } satisfies DashboardEntryReferences
  })
  canPublish = atom(get => {
    return get(this.entryData).parents.every(
      parent => parent.status === 'published'
    )
  })

  parentUnpublished = atom(get => {
    return get(this.entryData).parents.some(parent => parent.status === 'draft')
  })

  icon = atom(get => getType(get(this.type)).icon)
  orderChildrenBy = atom(get => getType(get(this.type)).orderChildrenBy)

  childrenFor = dispense((locale: string | null) => {
    return swr(
      atom(async get => {
        const root = get(this.root)
        return queryTreeChildren(
          get,
          root,
          this.id,
          get(this.orderChildrenBy),
          locale
        )
      })
    )
  })

  children = atom(get => {
    const root = get(this.root)
    return get(this.childrenFor(get(root.selectedLocale)))
  })

  untranslated = atom(get => {
    const root = get(this.root)
    return this.#untranslatedFor(get, get(root.selectedLocale))
  })

  availableStatusesFor = dispense((locale: string | null) =>
    atom(async get => {
      const sourceLocale = this.sourceLocaleFor(get, locale)
      const versions = await get(this.languages(sourceLocale).versionsResource)
      return [...versions.keys()]
    })
  )

  activeVersionFor = dispense((locale: string | null) =>
    atom(async get => {
      const locales = get(this.locales)
      const sourceLocale = this.sourceLocaleFor(get, locale)
      const entry = locales.get(sourceLocale)
      if (entry) return entry
      for (const fallback of locales.values()) {
        if (fallback.title) return fallback
      }
      return null
    })
  )

  activeVersion = swr(
    atom(async get => {
      const root = get(this.root)
      return get(this.activeVersionFor(get(root.selectedLocale)))
    })
  )

  anchors = swr(
    atom(async get => {
      const locale = get(this.sourceLocale)
      return get(this.languages(locale).anchors)
    })
  )

  parentNeedsTranslationFor = dispense((locale: string | null) =>
    atom(async get => {
      if (!this.#untranslatedFor(get, locale)) return false
      const parentId = get(this.entryData).parentId
      if (!parentId) return false
      if (!locale) return false
      const db = get(graphAtom)
      const parentLink = await db.first({
        select: Entry.id,
        id: parentId,
        locale,
        status: 'preferDraft'
      })
      return !parentLink
    })
  )

  #previewAtoms = createEntryPreviewAtoms(this)
  preview = this.#previewAtoms.preview
  retryPreviewUrl = this.#previewAtoms.retryPreviewUrl
  previewEntryFor = this.#previewAtoms.previewEntryFor
  previewPayloadSignal = this.#previewAtoms.previewPayloadSignal
  updatePreviewPayload = this.#previewAtoms.updatePreviewPayload
  previewUrlFor = this.#previewAtoms.previewUrlFor

  languages = dispense((locale: string | null) => {
    return new EntryLanguageAtoms(this, locale)
  })

  routeBlock = atom<EntryRouteBlock | null>(null)

  needsBlock = atom(
    null,
    (get, set, signal: AbortSignal): boolean | Promise<boolean> => {
      if (signal.aborted) return false
      const currentNode = get(this.currentlyEditing)
      if (!currentNode || !get(currentNode.isDirty)) return true

      get(this.routeBlock)?.cancel()
      return new Promise(resolve => {
        let settled = false
        const finish = (allowed: boolean) => {
          if (settled) return
          settled = true
          signal.removeEventListener('abort', cancel)
          set(this.routeBlock, null)
          resolve(allowed)
        }
        const confirm = () => finish(true)
        const cancel = () => finish(false)
        signal.addEventListener('abort', cancel, {once: true})
        set(this.routeBlock, {confirm, cancel})
      })
    }
  )

  currentlyEditing = atom<ReactiveNode<object>>()

  async #assertPermission(
    get: Getter,
    permission: Permission,
    locale: string | null
  ) {
    const activeVersion = await get(this.languages(locale).activeVersion)
    get(policyAtom).assert(permission, activeVersion)
    return activeVersion
  }

  async #beforeSave(
    get: Getter,
    node: ReactiveNode<object>,
    type: Type,
    action: 'update' | 'publish' | 'translate'
  ) {
    const user = await get(userAtom)
    const current = get(node.value) as Record<string, unknown>
    const data = Type.beforeSave(type, current, {
      action,
      user,
      now: new Date()
    })
    return {data, changed: data !== current}
  }

  saveDraft = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Update, locale)
    const db = get(graphAtom)
    const type = get(this.type)
    const {data, changed} = await this.#beforeSave(get, node, type, 'update')
    await db.create({
      type,
      id: this.id,
      locale: locale,
      status: 'draft',
      set: data,
      overwrite: true
    })
    if (changed) set(node.value, data)
    set(node.commit)
    await set(refreshCurrentRouteAtom)
  })

  publishEdits = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(graphAtom)
    const type = get(this.type)
    const {data, changed} = await this.#beforeSave(get, node, type, 'publish')
    await db.create({
      type,
      id: this.id,
      locale,
      status: 'published',
      set: data,
      overwrite: true
    })
    if (changed) set(node.value, data)
    set(node.commit)
    await set(refreshCurrentRouteAtom)
  })

  publishDraft = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(graphAtom)
    await db.publish({
      id: this.id,
      locale,
      status: 'draft'
    })
    await set(refreshCurrentRouteAtom)
  })

  discardDraft = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Update, locale)
    const db = get(graphAtom)
    await db.discard({
      id: this.id,
      locale,
      status: 'draft'
    })
    await set(refreshCurrentRouteAtom)
  })

  unpublish = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(graphAtom)
    await db.unpublish({
      id: this.id,
      locale
    })
    await set(refreshCurrentRouteAtom)
  })

  archive = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Archive, locale)
    const db = get(graphAtom)
    await db.archive({
      id: this.id,
      locale
    })
    await set(refreshCurrentRouteAtom)
  })

  publishArchived = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(graphAtom)
    await db.publish({
      id: this.id,
      locale,
      status: 'archived'
    })
    await set(refreshCurrentRouteAtom)
  })

  deleteEntry = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Delete, locale)
    const db = get(graphAtom)
    const entry = get(this.entryData)
    set(locallyDeletingEntryAtom, this.id)
    try {
      const navigated = await set(routeAtom, {
        workspace: entry.workspace,
        root: entry.root,
        entry: entry.parentId ?? undefined,
        locale: get(routeAtom).locale
      })
      if (!navigated) throw new Error('Could not navigate away before deletion')
      await db.remove(this.id)
    } finally {
      if (get(locallyDeletingEntryAtom) === this.id)
        set(locallyDeletingEntryAtom, undefined)
    }
  })

  replaceFile = atom(null, async (get, set, file: File) => {
    const locale = get(this.sourceLocale)
    const activeVersion = await get(this.languages(locale).activeVersion)
    const policy = get(policyAtom)
    policy.assert(Permission.Update, activeVersion)
    policy.assert(Permission.Upload, activeVersion)
    const db = get(graphAtom)
    const error = uploadSizeError(file, get(configAtom).maxUploadSize)
    if (error) {
      set(uploadProgressAtom, {
        type: 'fail',
        uploads: [{id: createId(), file, error}],
        destination: {
          workspace: activeVersion.workspace,
          root: activeVersion.root,
          parentId: activeVersion.parentId ?? undefined
        }
      })
      return
    }
    await db.commit(
      new UploadOperation({
        file,
        createPreview,
        replaceId: this.id,
        parentId: activeVersion.parentId,
        workspace: activeVersion.workspace,
        root: activeVersion.root
      })
    )
  })

  saveTranslation = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    assert(locale, `Cannot translate entry ${this.id} without a locale`)
    const sourceLocale = get(this.translationSourceLocale)
    assert(
      sourceLocale,
      `Cannot translate entry ${this.id} without a source locale`
    )
    const activeVersion = await get(this.languages(sourceLocale).activeVersion)
    get(policyAtom).assert(Permission.Update, {
      ...activeVersion,
      locale
    })
    const parentId = activeVersion.parentId
    const db = get(graphAtom)
    if (parentId) {
      const parentLink = await db.first({
        select: Entry.id,
        id: parentId,
        locale,
        status: 'preferDraft'
      })
      assert(parentLink, 'Parent not translated')
    }
    const config = get(configAtom)
    const type = get(this.type)
    const {data, changed} = await this.#beforeSave(get, node, type, 'translate')
    await db.create({
      type,
      id: this.id,
      parentId,
      locale,
      status: config.enableDrafts ? 'draft' : 'published',
      set: data
    })
    if (changed) set(node.value, data)
    set(node.commit)
  })
}

function historyDataKey(version: {file: string; ref: string}) {
  return `${version.ref}\0${version.file}`
}

function parseHistoryDataKey(key: string): [ref: string, file: string] {
  const index = key.indexOf('\0')
  assert(index !== -1, 'Invalid history data key')
  return [key.slice(0, index), key.slice(index + 1)]
}

function dashboardEntryFile(
  config: Config,
  entry: Pick<Entry, 'filePath' | 'root' | 'workspace'>
) {
  const workspace = config.workspaces[entry.workspace]
  assert(workspace, `Workspace "${entry.workspace}" does not exist`)
  const root = getWorkspace(workspace).roots[entry.root]
  assert(root, `Root "${entry.root}" does not exist`)
  return join(Config.contentDir(config), entry.filePath)
}

function entryReferenceKey(reference: EntryReference): string {
  return `${reference.sourceId}\0${reference.sourceLocale ?? ''}`
}

function entryReferenceSourceKey(
  source: DashboardEntryReferenceSource
): string {
  return `${source.id}\0${source.locale ?? ''}`
}

export type {
  DashboardEntryReference,
  DashboardEntryReferences,
  DashboardEntryReferenceSource,
  DashboardEntryTreeStatus,
  DashboardFileInfoState,
  EntryRouteBlock
}
export type {EntryLanguageAtoms} from './entry/load.js'
export const entryAtoms = dispense((id: string) => new EntryAtoms(id))
