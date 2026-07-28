import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {Config} from '#/core/Config.js'
import type {Revision} from '#/core/Connection.js'
import {UploadOperation} from '#/core/db/Operation.js'
import type {EntryReference} from '#/core/db/EntryReference.js'
import {
  Entry,
  type Entry as EntryRecord,
  type EntryStatus
} from '#/core/Entry.js'
import {createRecord, parseRecord} from '#/core/EntryRecord.js'
import {Field, type FieldOptions} from '#/core/Field.js'
import {createId} from '#/core/Id.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {createPreview} from '#/core/media/CreatePreview.browser.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {Permission} from '#/core/Role.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {Type} from '#/core/Type.js'
import {assert} from '#/core/util/Assert.js'
import {isRecord} from '#/core/util/Objects.js'
import {join} from '#/core/util/Paths.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import type {Infer} from '#/types.js'
import type {Atom, Getter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {
  entryOverviewColumnCount,
  type EntryOverviewCell,
  type EntryView,
  MissingEntryError
} from './Contracts.js'
import {typeAtoms, type TypeState} from './EditorAtoms.js'
import {loadEntryPage} from './loaders/Entry.js'
import {ReactiveNode} from './ReactiveNode.js'
import {queryTreeChildren, type Root} from './RootAtoms.js'
import {dispense} from './AtomUtils.js'
import {debounce, keepPrevious, withPending} from './Async.js'
import {
  clientAtom,
  configAtom,
  graphAtom,
  previewTokenRequestsAtom
} from './CoreAtoms.js'
import {entryLoaderAtom} from './EntryLoaderAtoms.js'
import {userAtom} from './AuthAtoms.js'
import {uploadProgressAtom} from './MutationAtoms.js'
import {reloadPageAtom} from './PageAtoms.js'
import {policyAtom} from './PolicyAtoms.js'
import {
  previewSessionOriginsAtom,
  requestPreviewSessionToken
} from './PreviewAtoms.js'
import {entryRevisionAtom} from './RevisionAtom.js'
import {shaAtom} from './SyncAtoms.js'
import {viewAtom} from './ViewAtom.js'
import {workspaceAtoms} from './WorkspaceAtoms.js'
import type {
  DashboardEntryReference,
  DashboardEntryReferences,
  DashboardEntryReferenceSource,
  DashboardEntryTreeStatus,
  DashboardFileInfoState,
  EntryRouteBlock
} from './entry/EntryContracts.js'
import {createEntryLanguage} from './entry/EntryLanguage.js'
import {uploadSizeError} from './shared/Upload.js'

const decoder = new TextDecoder()

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
    path: string
    type: string
    status: EntryStatus
    main: boolean
  }>
  entries: Array<EntryVersionData>
}

export interface DashboardEntryState {
  pending: boolean
  data: EntryDataModel | undefined
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

class EntryModel {
  data: Atom<DashboardEntryState>
  readyState: Atom<Promise<DashboardEntryState>>
  #selectedView = atom<EntryView | undefined>(undefined)

  constructor(public id: string) {
    const entryData = atom<Promise<EntryData>>(async get => {
      get(entryRevisionAtom(id))
      return get(this.preload)
    })
    let data: EntryDataModel
    const loaded = atom(async get => {
      const initial = await get(entryData)
      return (data ??= createEntryData(
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
    const load = get(entryLoaderAtom)
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
    async (get, set, view: EntryView | undefined) => {
      if (view === 'edit') {
        const ready = await get(this.readyState)
        if (ready.data) {
          const root = get(ready.data.root)
          await loadEntryPage(get, ready.data, get(root.selectedLocale))
        }
      }
      set(this.#selectedView, view)
      await set(reloadPageAtom)
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

class EntryDataModel {
  workspaceKey: Atom<string>
  rootKey: Atom<string>
  hasChildren: Atom<boolean>
  type: Atom<TypeState>
  overviewCells: Atom<Array<EntryOverviewCell>>
  defaultView: Atom<'edit' | 'overview'>
  view: WritableAtom<EntryView, [view: EntryView], void>
  locales: Atom<Map<string | null, EntryVersionData>>
  parentId: Atom<string | null>
  parentIds: Atom<Array<string>>
  root: Atom<Root>
  #translationSourceLocale = atom<string | null | undefined>(undefined)
  #nodes = new Map<string, Atom<Promise<ReactiveNode<object>>>>()

  #untranslatedFor(get: Getter, locale: string | null) {
    return !get(this.locales).has(locale)
  }

  #sourceLocaleFor(get: Getter, locale: string | null) {
    if (this.#untranslatedFor(get, locale))
      return get(this.translationSourceLocale)
    return locale
  }

  sourceLocaleFor(get: Getter, locale: string | null) {
    return this.#sourceLocaleFor(get, locale)
  }

  #selectedVersionFor(get: Getter, locale: string | null): SelectedVersion {
    const selected = get(this.#selection)
    if (selected) return selected
    const sourceLocale = this.#sourceLocaleFor(get, locale)
    const entry = get(this.locales).get(sourceLocale)
    assert(entry, `Entry ${this.id} has no data for locale ${sourceLocale}`)
    return {type: 'status', status: entry.status}
  }

  currentEntryFor = dispense((locale: string | null) =>
    atom(async (get): Promise<Entry | null> => {
      const selected = this.#selectedVersionFor(get, locale)
      const sourceLocale = this.#sourceLocaleFor(get, locale)
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

  currentEntry = keepPrevious(
    atom(async get => {
      const root = get(this.root)
      return get(this.currentEntryFor(get(root.selectedLocale)))
    })
  )

  customView = atom(get => {
    const type = get(this.type)
    const {view} = getType(type.type)
    if (typeof view === 'string') return get(viewAtom(view))
    return view
  })

  constructor(
    public entry: EntryModel,
    public entryData: Atom<EntryData>
  ) {
    const data = this.entryData
    this.workspaceKey = atom(get => get(data).workspace)
    this.rootKey = atom(get => get(data).root)
    this.hasChildren = atom(get => get(data).hasChildren)
    this.type = atom(get => get(typeAtoms(get(data).type)))
    this.defaultView = atom(get => {
      if (get(this.hasChildren)) return 'overview'
      const configured = get(this.type).defaultView
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
    this.parentId = atom(get => get(data).parentId)
    this.parentIds = atom(get => get(data).parents.map(parent => parent.id))
    this.locales = atom(
      get =>
        new Map(
          get(data).entries.map(entry => {
            return [entry.locale, entry] as const
          })
        )
    )
    this.root = atom(get => {
      const workspace = get(this.workspaceKey)
      const root = get(this.rootKey)
      return workspaceAtoms(workspace).root(root)
    })
    this.overviewCells = atom(get => {
      const entry = get(this.currentEntry)
      if (!entry || entry instanceof Promise) return []
      const type = get(this.type).type
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
    async (get, set, locale: string) => {
      if (get(this.#translationSourceLocale) === locale) return
      const localized = get(this.locales).get(locale)
      assert(localized, `Entry ${this.id} has no data for locale ${locale}`)
      await get(
        this.#node({
          locale,
          untranslated: get(this.untranslated),
          version: {type: 'status', status: localized.status}
        })
      )
      set(this.#translationSourceLocale, locale)
      set(this.currentlyEditing, undefined)
      set(this.#selection, undefined)
      await set(reloadPageAtom)
    }
  )

  sourceLocale = atom(get => {
    const root = get(this.root)
    return this.#sourceLocaleFor(get, get(root.selectedLocale))
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
    async (get, set, next: SelectedVersion) => {
      await get(
        this.#node({
          locale: get(this.sourceLocale),
          untranslated: get(this.untranslated),
          version: next
        })
      )
      set(this.#selection, next)
      await set(reloadPageAtom)
    }
  )

  historyFor = dispense((locale: string | null) =>
    atom(async (get): Promise<Array<Revision>> => {
      const config = get(configAtom)
      const sourceLocale = this.#sourceLocaleFor(get, locale)
      const data = get(this.locales).get(sourceLocale)
      assert(data, `No locale data found for locale ${sourceLocale}`)
      const file = dashboardEntryFile(config, {
        workspace: get(this.workspaceKey),
        root: get(this.rootKey),
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
      const type = get(this.type).type
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
      const sourceLocale = this.#sourceLocaleFor(get, locale)
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

  selectedNode = keepPrevious(
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

  fileInfo = keepPrevious(
    atom(async (get): Promise<Infer<typeof MediaFile> | null> => {
      if (get(this.type).type !== MediaFile) return null
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
    const parentIds = get(this.parentIds)
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

  #incomingReferences = atom(async get => {
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
  incomingReferencesResource = this.#incomingReferences

  canPublish = atom(get => {
    return get(this.parentInfo).every(parent => parent.status === 'published')
  })

  parentUnpublished = atom(get => {
    return get(this.parentInfo).some(parent => parent.status === 'draft')
  })

  parentInfo = atom(get => {
    return get(this.entryData).parents
  })

  icon = atom(get => get(this.type).icon)

  childrenFor = dispense((locale: string | null) => {
    return keepPrevious(
      atom(async get => {
        const root = get(this.root)
        const orderChildrenBy = atom(get => get(this.type).orderChildrenBy)
        return queryTreeChildren(get, root, this.id, orderChildrenBy, locale)
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
      const sourceLocale = this.#sourceLocaleFor(get, locale)
      const versions = await get(this.languages(sourceLocale).versionsResource)
      return [...versions.keys()]
    })
  )

  activeVersionFor = dispense((locale: string | null) =>
    atom(async get => {
      const locales = get(this.locales)
      const sourceLocale = this.#sourceLocaleFor(get, locale)
      const entry = locales.get(sourceLocale)
      if (entry) return entry
      for (const fallback of locales.values()) {
        if (fallback.title) return fallback
      }
      return null
    })
  )

  activeVersion = keepPrevious(
    atom(async get => {
      const root = get(this.root)
      return get(this.activeVersionFor(get(root.selectedLocale)))
    })
  )

  anchors = keepPrevious(
    atom(async get => {
      const locale = get(this.sourceLocale)
      return get(this.languages(locale).anchors)
    })
  )

  parentNeedsTranslationFor = dispense((locale: string | null) =>
    atom(async get => {
      if (!this.#untranslatedFor(get, locale)) return false
      const parentId = get(this.parentId)
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

  preview = atom(get => {
    const type = get(this.type).type
    if (type === MediaLibrary) return undefined
    const typePreview = Type.preview(type)
    if (typePreview !== undefined) return typePreview
    const config = get(configAtom)
    const workspace = config.workspaces[get(this.workspaceKey)]
    if (!workspace) return config.preview
    const root = workspace[get(this.rootKey)]
    return (
      (root ? getRoot(root).preview : undefined) ??
      getWorkspace(workspace).preview ??
      config.preview
    )
  })

  hasPreview = atom(get => Boolean(get(this.preview)))

  #previewRetry = atom(0)

  retryPreviewUrl = atom(null, (get, set) => {
    set(this.#previewRetry, current => current + 1)
  })

  previewEntryFor = dispense((locale: string | null) =>
    atom(async get => {
      if (!get(this.hasPreview)) return null
      const sourceLocale = this.#sourceLocaleFor(get, locale)
      const language = this.languages(sourceLocale)
      const activeVersion = await get(language.activeVersionResource)
      const node = await get(this.selectedNodeFor(locale))
      const value = get(node.value)
      if (!isRecord(value)) return activeVersion
      const title =
        typeof value.title === 'string' ? value.title : activeVersion.title
      const path =
        typeof value.path === 'string' ? value.path : activeVersion.path
      return {
        ...activeVersion,
        title,
        path,
        data: value
      }
    })
  )

  #previewPayloadSignal = atom(get => {
    if (get(this.preview) !== true) return undefined
    const selected = get(this.selectedVersion)
    const currentNode = get(this.currentlyEditing)
    const selectedKey =
      selected.type === 'status' ? selected.status : selected.ref
    return [selected.type, selectedKey, currentNode && get(currentNode.value)]
  })
  previewPayloadSignal = debounce(this.#previewPayloadSignal, 250)

  updatePreviewPayload = atom(null, async get => {
    if (get(this.preview) !== true) return undefined
    const node = await get(this.selectedNode)
    const value = get(node.value)
    if (!isRecord(value)) return undefined
    const sha = await get(shaAtom)
    if (!sha) return undefined

    const root = get(this.root)
    const locale = get(root.selectedLocale)
    const activeVersion = await get(this.languages(locale).activeVersion)
    if (!activeVersion) return undefined
    const selected = get(this.selectedVersion)
    const status =
      selected.type === 'status' ? selected.status : activeVersion.status

    const nextTitle =
      typeof value.title === 'string' ? value.title : activeVersion.title
    const nextPath =
      typeof value.path === 'string' ? value.path : activeVersion.path
    const nextVersion = {
      ...activeVersion,
      title: nextTitle,
      path: nextPath,
      data: value,
      status
    }
    const schema = get(configAtom).schema
    const baseText = decoder.decode(
      JsonLoader.format(
        schema,
        createRecord(activeVersion, activeVersion.status)
      )
    )
    const nextText = decoder.decode(
      JsonLoader.format(schema, createRecord(nextVersion, status))
    )
    const patch = await createFilePatch(baseText, nextText)
    return encodePreviewPayload({
      locale: activeVersion.locale,
      entryId: activeVersion.id,
      contentHash: sha,
      status,
      patch
    })
  })

  previewUrlFor = dispense((locale: string | null) =>
    atom(async get => {
      if (get(this.preview) !== true) return undefined
      get(this.#previewRetry)
      const client = get(clientAtom)
      if (!client || typeof client.previewToken !== 'function') return undefined
      const config = get(configAtom)
      const sourceLocale = this.#sourceLocaleFor(get, locale)
      const activeVersion = await get(
        this.languages(sourceLocale).activeVersionResource
      )
      if (!activeVersion) return undefined
      try {
        const base = new URL(
          config.handlerUrl ?? '',
          Config.baseUrl(config) ??
            (typeof location === 'undefined'
              ? 'http://localhost'
              : location.href)
        )
        const origin = base.origin
        if (get(previewSessionOriginsAtom).has(origin))
          return new URL(activeVersion.url, origin).toString()

        const previewToken = await requestPreviewSessionToken(
          get(previewTokenRequestsAtom),
          origin,
          client
        )
        base.searchParams.set('preview', previewToken)
        base.searchParams.set('returnTo', activeVersion.url)
        return base.toString()
      } catch {
        return undefined
      }
    })
  )

  languages = dispense((locale: string | null) => {
    return createEntryLanguage(this, locale)
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
    const type = get(this.type).type
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
  })

  publishEdits = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(graphAtom)
    const type = get(this.type).type
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
  })

  publishDraft = atom(null, async (get, _set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(graphAtom)
    await db.publish({
      id: this.id,
      locale,
      status: 'draft'
    })
  })

  discardDraft = atom(null, async (get, _set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Update, locale)
    const db = get(graphAtom)
    await db.discard({
      id: this.id,
      locale,
      status: 'draft'
    })
  })

  unpublish = atom(null, async (get, _set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(graphAtom)
    await db.unpublish({
      id: this.id,
      locale
    })
  })

  archive = atom(null, async (get, _set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Archive, locale)
    const db = get(graphAtom)
    await db.archive({
      id: this.id,
      locale
    })
  })

  publishArchived = atom(null, async (get, _set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(graphAtom)
    await db.publish({
      id: this.id,
      locale,
      status: 'archived'
    })
  })

  deleteEntry = atom(null, async get => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Delete, locale)
    const db = get(graphAtom)
    await db.remove(this.id)
  })

  replaceFile = atom(null, async (get, set, file: File) => {
    const locale = get(this.sourceLocale)
    const activeVersion = await get(this.languages(locale).activeVersion)
    const policy = get(policyAtom)
    policy.assert(Permission.Update, activeVersion)
    policy.assert(Permission.Upload, activeVersion)
    const db = get(graphAtom)
    const error = uploadSizeError(
      file,
      get(configAtom).maxUploadSize
    )
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
    const type = get(this.type).type
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

export type EntryState = EntryModel
export type EntryDataState = EntryDataModel
export type {
  DashboardEntryReference,
  DashboardEntryReferences,
  DashboardEntryReferenceSource,
  DashboardEntryTreeStatus,
  DashboardFileInfoState,
  EntryRouteBlock
}
export type {EntryLanguage} from './entry/EntryLanguage.js'
export {createEntryLanguage}

export function createEntry(id: string): EntryState {
  return new EntryModel(id)
}

export const entryAtoms = dispense((id: string) => createEntry(id))

export function createEntryData(
  entry: EntryState,
  entryData: Atom<EntryData>
): EntryDataState {
  return new EntryDataModel(entry, entryData)
}
