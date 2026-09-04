import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {Config} from '#/core/Config.js'
import type {
  EntryReference,
  EntryReferenceScan
} from '#/core/db/EntryReference.js'
import {Entry, EntryStatus} from '#/core/Entry.js'
import type {Order} from '#/core/Graph.js'
import {createRecord, parseRecord} from '#/core/EntryRecord.js'
import type {FieldBeforeSaveAction} from '#/core/Field.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {createPreview} from '#/core/media/CreatePreview.browser.js'
import {mediaAltText} from '#/core/media/MediaAltField.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Permission} from '#/core/Role.js'
import {Root} from '#/core/Root.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {Type, type EntryDefaultView} from '#/core/Type.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {entries} from '#/core/util/Objects.js'
import {join} from '#/core/util/Paths.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import {parents, translations} from '#/query.js'
import {Atom, atom, Getter} from 'jotai'
import {unwrap} from 'jotai/utils'
import {clientAtom, configAtom, graphAtom} from './core.js'
import type {ResolvedEditorImage} from './editor.js'
import {entryRevisionAtom, shaAtom} from './graph.js'
import {getPreviewToken, retryPreviewToken} from './preview.js'
import {ReactiveNode} from './ReactiveNode.js'
import {policyAtom, userAtom} from './user.js'
import {atomWithPending, dispense, loader} from './utils.js'

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
  entries: Array<Entry>
}

export interface EntryReferences {
  references: Array<EntryReferenceWithSource>
  total: number
  scan: EntryReferenceScan
}

export interface EntryReferenceWithSource {
  reference: EntryReference
  source: EntryReferenceSource
}

export interface EntryReferenceSource {
  id: string
  title: string
  type: string
  workspace: string
  root: string
  locale: string | null
  status: EntryStatus
  path: string
  url: string
}

const selection = {
  id: Entry.id,
  type: Entry.type,
  parentId: Entry.parentId,
  workspace: Entry.workspace,
  root: Entry.root,
  parents: parents({
    select: {
      id: Entry.id,
      path: Entry.path,
      type: Entry.type,
      status: Entry.status,
      main: Entry.main
    }
  }),
  entries: translations({select: Entry, includeSelf: true})
}

export type SelectedVersion =
  | {type: 'status'; status: EntryStatus}
  | {type: 'history'; file: string; ref: string}

function prepareData(
  get: Getter,
  node: ReactiveNode<object>,
  type: Type,
  action: FieldBeforeSaveAction,
  user: User
) {
  const current = get(node.value) as Record<string, unknown>
  return {
    checkpoint: current,
    data: Type.beforeSave(type, current, {
      action,
      user,
      now: new Date()
    })
  }
}

export class EntryLocaleAtoms {
  constructor(
    public readonly entry: EntryAtoms,
    public readonly requestedLocale: string | null
  ) {}

  currentlyEditing = atom<ReactiveNode<object>>()
  untranslated = atom(get => {
    const data = get(this.entry.data)
    return !data.entries.some(entry => entry.locale === this.requestedLocale)
  })
  #selectedTranslationSourceLocale = atom<string>()
  translationSourceLocale = atom(
    get => {
      const data = get(this.entry.data)
      const locales = data.entries.flatMap(entry => {
        return entry.locale === null ? [] : [entry.locale]
      })
      const selected = get(this.#selectedTranslationSourceLocale)
      return selected && locales.includes(selected)
        ? selected
        : (locales[0] ?? null)
    },
    (get, set, next: string) => {
      set(this.#selectedTranslationSourceLocale, next)
      set(this.currentlyEditing, undefined)
    }
  )
  parentNeedsTranslation = atom(async get => {
    const data = get(this.entry.data)
    const translated = data.entries.some(
      entry => entry.locale === this.requestedLocale
    )
    if (translated || !this.requestedLocale || !data.parentId) return false
    const graph = get(graphAtom)
    const parent = await graph.first({
      select: Entry.id,
      id: data.parentId,
      locale: this.requestedLocale,
      status: 'preferDraft'
    })
    return !parent
  })
  selectedVersion = atom<SelectedVersion | null>(null)
  versions = atom(get => {
    const data = get(this.entry.data)
    const selectedLocale = data.entries.some(
      entry => entry.locale === this.requestedLocale
    )
      ? this.requestedLocale
      : get(this.translationSourceLocale)
    return new Map(
      data.entries
        .filter(entry => entry.locale === selectedLocale)
        .map(entry => [entry.status, entry] as const)
    )
  })
  availableStatuses = atom(get => {
    return Array.from(get(this.versions).keys())
  })
  selectedEntry = atom(async (get): Promise<Entry> => {
    const data = get(this.entry.data)
    const translated = data.entries.some(
      entry => entry.locale === this.requestedLocale
    )
    const sourceLocale = translated
      ? this.requestedLocale
      : get(this.translationSourceLocale)
    const localeEntries = data.entries.filter(
      entry => entry.locale === sourceLocale
    )
    assert(localeEntries.length > 0, `No readable entry for "${this.entry.id}"`)
    const version = get(this.selectedVersion)
    if (!version) return localeEntries[0]
    if (version.type === 'status')
      return (
        localeEntries.find(entry => entry.status === version.status) ??
        localeEntries[0]
      )
    const client = get(clientAtom)
    const revision = await client.revisionData(version.file, version.ref)
    const activeEntry = localeEntries[0]
    if (!revision) return activeEntry
    const historyData = parseRecord(revision).data
    return {
      ...activeEntry,
      title:
        typeof historyData.title === 'string'
          ? historyData.title
          : activeEntry.title,
      path:
        typeof historyData.path === 'string'
          ? historyData.path
          : activeEntry.path,
      data: historyData
    }
  })
  historyReady = atom(async get => {
    const versions = get(this.versions)
    const entry =
      Array.from(versions.values()).find(version => version.active) ??
      versions.values().next().value
    assert(entry, `No readable entry for "${this.entry.id}"`)
    const config = get(configAtom)
    const client = get(clientAtom)
    const file = join(Config.contentDir(config), entry.filePath)
    return (await client.revisions(file)).slice(1)
  })
  history = unwrap(this.historyReady, previous => previous ?? [])

  selectedNode = atom(async get => {
    const version = get(this.selectedVersion)
    const entry = await get(this.selectedEntry)
    const isUntranslated = get(this.untranslated)
    if (!version || (version.type === 'status' && entry.active)) {
      const editing = get(this.currentlyEditing)
      if (editing) return editing
    }
    const config = get(configAtom)
    const type = config.schema[entry.type]
    assert(type, `Type "${entry.type}" not found in config`)
    const policy = get(policyAtom)
    const readOnly =
      version?.type === 'history' ||
      (!isUntranslated && (!entry.active || !policy.canUpdate(entry)))
    const value = Type.withInitialValue(type, {
      ...Type.initialValue(type),
      ...entry.data,
      ...(isUntranslated ? {path: undefined} : undefined)
    })
    return new ReactiveNode<object>(value, readOnly)
  })
  richTextImages = atom(async get => {
    const entry = await get(this.selectedEntry)
    const config = get(configAtom)
    const type = config.schema[entry.type]
    assert(type, `Type "${entry.type}" not found in config`)
    const value = Type.withInitialValue(type, {
      ...Type.initialValue(type),
      ...entry.data
    })
    const imageIds = Array.from(
      new Set(
        Type.references(type, value)
          .filter(reference => reference.linkType === 'image')
          .map(reference => reference.targetId)
      )
    )
    if (imageIds.length === 0) return new Map<string, ResolvedEditorImage>()
    const graph = get(graphAtom)
    const images = await graph.find({
      id: {in: imageIds},
      preferredLocale: this.requestedLocale ?? entry.locale ?? undefined,
      status: 'preferDraft',
      select: {
        id: Entry.id,
        url: Entry.url,
        alt: MediaFile.alt
      }
    })
    const baseUrl =
      Config.baseUrl(config) ??
      (typeof location === 'undefined' ? undefined : location.href)
    return new Map(
      images.map(image => [
        image.id,
        {
          src: URL.parse(image.url, baseUrl)?.href ?? '',
          alt: mediaAltText(
            image.alt,
            this.requestedLocale ?? entry.locale ?? undefined
          )
        }
      ])
    )
  })
  anchors = atom(async get => {
    const entry = await get(this.selectedEntry)
    const node = await get(this.selectedNode)
    const type = get(configAtom).schema[entry.type]
    assert(type, `Type "${entry.type}" not found in config`)
    return Type.anchors(type, get(node.value) as Record<string, unknown>)
  })
  #previewUrlRetry = atom(0)
  retryPreviewUrl = atom(null, (get, set) => {
    retryPreviewToken(get(clientAtom))
    set(this.#previewUrlRetry, current => current + 1)
  })
  previewEntryReady = atom(async get => {
    const activeEntry = await get(this.selectedEntry)
    const node = await get(this.selectedNode)
    const value = get(node.value) as Record<string, unknown>
    return {
      ...activeEntry,
      title: typeof value.title === 'string' ? value.title : activeEntry.title,
      path: typeof value.path === 'string' ? value.path : activeEntry.path,
      data: value
    }
  })
  previewEntry = unwrap(this.previewEntryReady, previous => previous)
  previewUrlReady = atom(async get => {
    get(this.#previewUrlRetry)
    const versions = get(this.versions)
    const targetUrl =
      Array.from(versions.values()).find(version => version.active)?.url ??
      versions.values().next().value?.url
    if (!targetUrl) return undefined
    const config = get(configAtom)
    try {
      const base = new URL(
        Config.handlerUrl(config),
        Config.baseUrl(config) ??
          (typeof location === 'undefined' ? 'http://localhost' : location.href)
      )
      const previewToken = await getPreviewToken(get(clientAtom))
      if (!previewToken) return undefined
      base.searchParams.set('preview', previewToken)
      base.searchParams.set('returnTo', targetUrl)
      return base.toString()
    } catch {
      return undefined
    }
  })
  previewUrlState = atomWithPending(this.previewUrlReady)
  previewPayloadSignal = atom(get => {
    const version = get(this.selectedVersion)
    const editing = get(this.currentlyEditing)
    return [version, editing ? get(editing.value) : undefined]
  })
  updatePreviewPayload = atom(null, async get => {
    const node = await get(this.selectedNode)
    const value = get(node.value) as Record<string, unknown>
    const activeEntry = Array.from(get(this.versions).values()).find(
      version => version.active
    )
    if (!activeEntry) return undefined
    const contentHash = await get(shaAtom)
    if (!contentHash) return undefined
    const selected = get(this.selectedVersion)
    const status =
      selected?.type === 'status' ? selected.status : activeEntry.status
    const nextEntry = {
      ...activeEntry,
      title: typeof value.title === 'string' ? value.title : activeEntry.title,
      path: typeof value.path === 'string' ? value.path : activeEntry.path,
      data: value,
      status
    }
    const schema = get(configAtom).schema
    const decoder = new TextDecoder()
    const baseText = decoder.decode(
      JsonLoader.format(schema, createRecord(activeEntry, activeEntry.status))
    )
    const nextText = decoder.decode(
      JsonLoader.format(schema, createRecord(nextEntry, status))
    )
    return encodePreviewPayload({
      locale: activeEntry.locale,
      entryId: activeEntry.id,
      contentHash,
      status,
      patch: await createFilePatch(baseText, nextText)
    })
  })

  saveDraft = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const dataState = get(this.entry.data)
    const {id, type} = dataState
    const policy = get(policyAtom)
    const config = get(configAtom)
    const typeConfig = config.schema[type]
    assert(typeConfig, `Type "${type}" not found in config`)
    const activeEntry = dataState.entries.find(entry => {
      return entry.locale === this.requestedLocale && entry.active
    })
    assert(activeEntry, `No active entry for locale "${this.requestedLocale}"`)
    const graph = get(graphAtom)
    const {checkpoint, data} = prepareData(
      get,
      node,
      typeConfig,
      'update',
      get(userAtom)
    )
    policy.assert(Permission.Update, activeEntry)
    const saved = await graph.create({
      type: typeConfig,
      id,
      locale: this.requestedLocale,
      status: 'draft',
      set: data,
      overwrite: true,
      select: Entry.data
    })
    set(node.rebase, {checkpoint, saved})
  })

  publishEdits = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const dataState = get(this.entry.data)
    const {id, type} = dataState
    const policy = get(policyAtom)
    const config = get(configAtom)
    const typeConfig = config.schema[type]
    assert(typeConfig, `Type "${type}" not found in config`)
    const activeEntry = dataState.entries.find(entry => {
      return entry.locale === this.requestedLocale && entry.active
    })
    assert(activeEntry, `No active entry for locale "${this.requestedLocale}"`)
    const graph = get(graphAtom)
    const {checkpoint, data} = prepareData(
      get,
      node,
      typeConfig,
      'publish',
      get(userAtom)
    )
    policy.assert(Permission.Publish, activeEntry)
    const saved = await graph.create({
      type: typeConfig,
      id,
      locale: this.requestedLocale,
      status: 'published',
      set: data,
      overwrite: true,
      select: Entry.data
    })
    set(node.rebase, {checkpoint, saved})
  })

  saveTranslation = atom(null, async (get, set, node: ReactiveNode<object>) => {
    assert(
      this.requestedLocale,
      `Cannot translate entry "${this.entry.id}" without a locale`
    )
    const dataState = get(this.entry.data)
    const sourceEntry = await get(this.selectedEntry)
    const policy = get(policyAtom)
    policy.assert(Permission.Update, {
      ...sourceEntry,
      locale: this.requestedLocale
    })
    if (dataState.parentId) {
      const graph = get(graphAtom)
      const parent = await graph.first({
        select: Entry.id,
        id: dataState.parentId,
        locale: this.requestedLocale,
        status: 'preferDraft'
      })
      assert(parent, 'Parent entry must be translated first')
    }
    const config = get(configAtom)
    const type = config.schema[dataState.type]
    assert(type, `Type "${dataState.type}" not found in config`)
    const {checkpoint, data} = prepareData(
      get,
      node,
      type,
      'translate',
      get(userAtom)
    )
    const graph = get(graphAtom)
    const saved = await graph.create({
      type,
      id: this.entry.id,
      parentId: dataState.parentId,
      locale: this.requestedLocale,
      status: config.enableDrafts ? 'draft' : 'published',
      set: data,
      select: Entry.data
    })
    set(node.rebase, {checkpoint, saved})
  })

  #activeEntry(get: Getter) {
    const data = get(this.entry.data)
    const entry = data.entries.find(candidate => {
      return candidate.locale === this.requestedLocale && candidate.active
    })
    assert(entry, `No active entry for locale "${this.requestedLocale}"`)
    return entry
  }

  publishDraft = atom(null, async get => {
    const entry = this.#activeEntry(get)
    get(policyAtom).assert(Permission.Publish, entry)
    await get(graphAtom).publish({
      id: this.entry.id,
      locale: this.requestedLocale,
      status: 'draft'
    })
  })
  discardDraft = atom(null, async get => {
    const entry = this.#activeEntry(get)
    get(policyAtom).assert(Permission.Update, entry)
    await get(graphAtom).discard({
      id: this.entry.id,
      locale: this.requestedLocale,
      status: 'draft'
    })
  })
  unpublish = atom(null, async get => {
    const entry = this.#activeEntry(get)
    get(policyAtom).assert(Permission.Publish, entry)
    await get(graphAtom).unpublish({
      id: this.entry.id,
      locale: this.requestedLocale
    })
  })
  archive = atom(null, async get => {
    const entry = this.#activeEntry(get)
    get(policyAtom).assert(Permission.Archive, entry)
    await get(graphAtom).archive({
      id: this.entry.id,
      locale: this.requestedLocale
    })
  })
  publishArchived = atom(null, async get => {
    const entry = this.#activeEntry(get)
    get(policyAtom).assert(Permission.Publish, entry)
    await get(graphAtom).publish({
      id: this.entry.id,
      locale: this.requestedLocale,
      status: 'archived'
    })
  })
  deleteEntry = atom(null, async get => {
    const entry = this.#activeEntry(get)
    get(policyAtom).assert(Permission.Delete, entry)
    await get(graphAtom).remove(this.entry.id)
  })
  replaceFile = atom(null, async (get, set, file: File) => {
    const entry = this.#activeEntry(get)
    const policy = get(policyAtom)
    policy.assert(Permission.Update, entry)
    policy.assert(Permission.Upload, entry)
    await get(graphAtom).upload({
      file,
      createPreview,
      replaceId: this.entry.id,
      parentId: entry.parentId,
      workspace: entry.workspace,
      root: entry.root
    })
    set(this.currentlyEditing, undefined)
  })
}

export class EntryAtoms {
  constructor(
    public readonly id: string,
    public readonly data: Atom<EntryData>
  ) {}

  // Should UI show overview or editor?
  #selectedView = atom<EntryDefaultView>()
  previousVersionsOpen = atom(false)

  incomingReferencesReady = atom(async get => {
    get(entryRevisionAtom(this.id))
    const graph = get(graphAtom)
    const policy = get(policyAtom)
    const result = await graph.referencesTo({
      targetId: this.id,
      status: 'preferDraft'
    })
    const sourceIds = Array.from(
      new Set(result.references.map(reference => reference.sourceId))
    )
    const sources =
      sourceIds.length === 0
        ? []
        : await graph.find({
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
    const sourceByLocale = new Map(
      sources.map(source => [referenceSourceKey(source), source] as const)
    )
    const sourceById = new Map(sources.map(source => [source.id, source]))
    const references = result.references.flatMap(reference => {
      const source =
        sourceByLocale.get(referenceKey(reference)) ??
        sourceById.get(reference.sourceId)
      if (!source || !policy.canRead(source)) return []
      return [{reference, source} satisfies EntryReferenceWithSource]
    })
    return {references, total: result.total, scan: result.scan}
  })
  incomingReferences = unwrap(
    this.incomingReferencesReady,
    previous => previous
  )

  #settings = atom(get => {
    const data = get(this.data)
    const typeConfig = get(configAtom).schema[data.type]
    const config = get(configAtom)
    const workspace = config.workspaces[data.workspace]
    assert(workspace, `Workspace "${data.workspace}" not found in config`)
    const root = getWorkspace(workspace).roots[data.root]
    assert(root, `Root "${data.root}" not found in config`)
    assert(typeConfig, `Type "${data.type}" not found in config`)
    const defaultView =
      Type.defaultView(typeConfig) ?? (data.hasChildren ? 'overview' : 'edit')
    const rootData = getRoot(root)
    const workspaceData = getWorkspace(workspace)
    const preview =
      Type.preview(typeConfig) ??
      rootData.preview ??
      workspaceData.preview ??
      config.preview
    return {defaultView, mediaI18n: Root.mediaI18n(rootData), preview}
  })

  type = atom(get => get(this.data).type)
  parentId = atom(get => get(this.data).parentId)
  workspace = atom(get => get(this.data).workspace)
  root = atom(get => get(this.data).root)
  parentPaths = atom(get =>
    get(this.data)
      .parents.filter(parent => parent.main)
      .map(parent => parent.path)
  )
  hasChildren = atom(get => get(this.data).hasChildren)
  canPublishParents = atom(get =>
    get(this.data).parents.every(parent => parent.status === 'published')
  )
  parentUnpublished = atom(get =>
    get(this.data).parents.some(parent => parent.status === 'draft')
  )
  mediaI18n = atom(get => get(this.#settings).mediaI18n)
  preview = atom(get => get(this.#settings).preview)
  translationSourceLocales = atom(get => {
    const data = get(this.data)
    return Array.from(
      new Set(
        data.entries.flatMap(entry =>
          entry.locale === null ? [] : [entry.locale]
        )
      )
    )
  })
  view = atom(
    get => get(this.#selectedView) ?? get(this.#settings).defaultView,
    (get, set, next: EntryDefaultView) => {
      set(this.#selectedView, next)
    }
  )

  locales = dispense(
    (locale: string | null) => new EntryLocaleAtoms(this, locale)
  )
}

export const entryAtoms = dispense((entryId: string) => {
  const data = atom(async get => {
    get(entryRevisionAtom(entryId))
    const load = get(entryLoader)
    const [result, error] = await load(entryId)
    if (error) {
      throw error
    }
    assert(result, `Entry "${entryId}" not found`)
    return result
  })
  let entry: EntryAtoms | undefined
  return atom(async get => {
    const initial = await get(data)
    return (entry ??= new EntryAtoms(
      entryId,
      unwrap(data, previous => previous ?? initial) as Atom<EntryData>
    ))
  })
})

function referenceKey(reference: {
  sourceId: string
  sourceLocale: string | null
}) {
  return `${reference.sourceId}\0${reference.sourceLocale ?? ''}`
}

function referenceSourceKey(source: EntryReferenceSource) {
  return `${source.id}\0${source.locale ?? ''}`
}

const entryLoader = atom(get => {
  const config = get(configAtom)
  const graph = get(graphAtom)
  const policy = get(policyAtom)
  const visibleTypes = entries(config.schema)
    .filter(([, type]) => !Type.isHidden(type))
    .map(([name]) => name)
  return loader(async ids => {
    const rows = await graph.find({
      groupBy: Entry.id,
      select: selection,
      id: {in: ids},
      status: 'preferDraft'
    })
    const parentIds = await graph.find({
      select: Entry.parentId,
      parentId: {in: ids},
      filter: {_type: {in: visibleTypes}},
      groupBy: Entry.parentId,
      status: 'preferDraft'
    })
    const byId = new Map(rows.map(row => [row.id, row] as const))
    return ids.map(id => {
      const row = byId.get(id)
      if (!row) return [null, new MissingEntryError(id)] as const
      const readableEntries = row.entries.filter(entry => policy.canRead(entry))
      if (readableEntries.length === 0)
        return [null, new MissingEntryError(id)] as const
      return [
        {
          ...row,
          entries: readableEntries,
          hasChildren: parentIds.includes(id)
        },
        null
      ] as const
    })
  })
})

export class MissingEntryError extends Error {
  constructor(public id: string) {
    super(`Missing entry ${id}`)
    this.name = 'MissingEntryError'
  }
}

export interface TreeEntrySummary {
  id: string
  title: string
  type: string
  status: EntryStatus
  main: boolean
  locale: string | null
  parentId: string | null
  parents: Array<string>
  workspace: string
  root: string
  hasChildren: boolean
}

interface TreeEntryData {
  entries: Array<Omit<TreeEntrySummary, 'hasChildren'>>
  hasChildren: boolean
}

interface TreeChildrenLocation {
  workspace: string
  root: string
  parentId: string | null
}

const treeEntrySelect = {
  id: Entry.id,
  title: Entry.title,
  type: Entry.type,
  status: Entry.status,
  main: Entry.main,
  locale: Entry.locale,
  parentId: Entry.parentId,
  parents: Entry.parents,
  workspace: Entry.workspace,
  root: Entry.root
}

const treeChildSelect = {
  id: Entry.id,
  type: Entry.type,
  locale: Entry.locale,
  parentId: Entry.parentId,
  parents: Entry.parents,
  workspace: Entry.workspace,
  root: Entry.root
}

function preferredTreeEntries<Item extends {id: string; locale: string | null}>(
  items: Array<Item>,
  locale: string | null
): Array<Item> {
  const translated = new Set(
    items.filter(item => item.locale === locale).map(item => item.id)
  )
  const untranslated = new Set<string>()
  return items.filter(item => {
    if (translated.has(item.id)) return item.locale === locale
    if (untranslated.has(item.id)) return false
    untranslated.add(item.id)
    return true
  })
}

export async function loadTreeChildren(
  get: Getter,
  location: TreeChildrenLocation,
  locale: string | null,
  orderBy?: Order | Array<Order>
): Promise<Array<TreeEntryAtoms>> {
  const config = get(configAtom)
  const graph = get(graphAtom)
  const policy = get(policyAtom)
  const visibleTypes = entries(config.schema)
    .filter(([, type]) => !Type.isHidden(type))
    .map(([name]) => name)
  const matches = await graph.find({
    ...location,
    filter: {_type: {in: visibleTypes}},
    orderBy,
    select: treeChildSelect,
    status: 'preferDraft'
  })
  return preferredTreeEntries(
    matches.filter(entry => policy.canRead(entry)),
    locale
  ).map(entry => treeEntryAtoms(entry.id))
}

const treeEntryLoader = atom(get => {
  const config = get(configAtom)
  const graph = get(graphAtom)
  const policy = get(policyAtom)
  const visibleTypes = entries(config.schema)
    .filter(([, type]) => !Type.isHidden(type))
    .map(([name]) => name)
  return loader<TreeEntryData>(async ids => {
    const [rows, children] = await Promise.all([
      graph.find({
        id: {in: ids},
        select: treeEntrySelect,
        status: 'preferDraft'
      }),
      graph.find({
        filter: {_type: {in: visibleTypes}},
        parentId: {in: ids},
        select: treeChildSelect,
        status: 'preferDraft'
      })
    ])
    const entriesById = new Map<string, Array<(typeof rows)[number]>>()
    for (const entry of rows) {
      const versions = entriesById.get(entry.id) ?? []
      versions.push(entry)
      entriesById.set(entry.id, versions)
    }
    const parentsWithChildren = new Set(
      children
        .filter(child => policy.canRead(child))
        .flatMap(child => (child.parentId ? [child.parentId] : []))
    )
    return ids.map(id => {
      const entryVersions = entriesById.get(id)
      if (!entryVersions) return [null, new MissingEntryError(id)] as const
      return [
        {
          entries: entryVersions,
          hasChildren: parentsWithChildren.has(id)
        },
        null
      ] as const
    })
  })
})

export class TreeEntryAtoms {
  #data = atom(async get => {
    get(entryRevisionAtom(this.id))
    const [data, error] = await get(treeEntryLoader)(this.id)
    if (error) throw error
    assert(data, `Tree entry "${this.id}" not found`)
    return data
  })

  constructor(public readonly id: string) {}

  ready = atom(async get => {
    await get(this.#data)
    return this
  })

  raw = dispense((locale: string | null) =>
    atom(async get => {
      const data = await get(this.#data)
      const entry = preferredTreeEntries(data.entries, locale)[0]
      assert(entry, `Tree entry "${this.id}" has no versions`)
      return entry
    })
  )

  summary = dispense((locale: string | null) =>
    atom(async get => {
      const data = await get(this.#data)
      const config = get(configAtom)
      const policy = get(policyAtom)
      const entry = preferredTreeEntries(
        data.entries.filter(candidate => {
          const type = config.schema[candidate.type]
          return Boolean(
            type && !Type.isHidden(type) && policy.canRead(candidate)
          )
        }),
        locale
      )[0]
      if (!entry) throw new MissingEntryError(this.id)
      return {...entry, hasChildren: data.hasChildren}
    })
  )

  parents = atom(async get => {
    const entry = await get(this.raw(null))
    const models = entry.parents.map(treeEntryAtoms)
    await Promise.all(models.map(model => get(model.ready)))
    return models
  })

  children = dispense((locale: string | null) =>
    atom(async get => {
      get(shaAtom)
      const entry = await get(this.raw(locale))
      const type = get(configAtom).schema[entry.type]
      assert(type, `Type "${entry.type}" not found in config`)
      return loadTreeChildren(
        get,
        {
          workspace: entry.workspace,
          root: entry.root,
          parentId: this.id
        },
        locale,
        getType(type).orderChildrenBy
      )
    })
  )
}

export const treeEntryAtoms = dispense((id: string) => new TreeEntryAtoms(id))
