import type {Entry} from '#/core/Entry.js'
import {parseRecord} from '#/core/EntryRecord.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import type {Source} from '#/core/source/Source.js'
import type {ReadonlyTree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
import {base64url} from '#/core/util/Encoding.js'
import {dirname, join} from '#/core/util/Paths.js'
import type {EntryCoreRecord, EntrySearchRecord} from '../entry/Model.js'
import {readAccessClass} from '../entry/Release.js'
import type {EntryLinkReference, EntryStore} from '../entry/Store.js'
import {
  BundleFrameLoader,
  type ByteRangeSourceFactory
} from '../replica/Bundle.js'
import {
  deserializeFrame,
  type SerializedFrameDescriptor
} from '../replica/Serialization.js'
import type {FrameDescriptor} from '../replica/Types.js'
import type {
  RuntimeDatabaseIndex,
  RuntimeDataFrame,
  RuntimeIndexEntry,
  RuntimeReferenceFrame,
  RuntimeSearchFrame
} from './Model.js'
import {
  decodeRuntimeReferenceFrame,
  decodeRuntimeSearchFrame,
  decodeRuntimeSourceDataFrame,
  decodeRuntimeSourceTree
} from './FrameSerialization.js'

export interface RuntimeEntryStoreOptions {
  index: RuntimeDatabaseIndex
  source: ByteRangeSourceFactory
}

export class RuntimeEntryStore implements EntryStore, Source {
  #index: RuntimeDatabaseIndex
  #source: ByteRangeSourceFactory
  #remoteSource?: ByteRangeSourceFactory
  #baseBundleUrl: string
  #loaders = new Map<string, BundleFrameLoader>()
  #pendingBytes = new Map<string, Promise<Uint8Array>>()
  #entryData = new Map<string, Promise<RuntimeDataFrame>>()
  #entries = new WeakMap<EntryCoreRecord, Promise<Entry | undefined>>()
  #decoded = new Map<string, Promise<unknown>>()
  #keys = new Map<string, Uint8Array>()
  #incoming?: Promise<ReadonlyMap<string, ReadonlyArray<EntryLinkReference>>>
  #decoder = new TextDecoder()
  #tree?: ReadonlyTree
  #sourceEntries = new Map<string, number>()
  #sourceTreeLoading?: Promise<ReadonlyTree>
  #sourceOverlay = new Map<string, Uint8Array>()

  constructor(options: RuntimeEntryStoreOptions) {
    this.#index = options.index
    this.#source = options.source
    this.#baseBundleUrl = options.index.bundleUrl
  }

  get revision(): string {
    return this.#index.revision
  }

  get index(): RuntimeDatabaseIndex {
    return this.#index
  }

  install(
    index: RuntimeDatabaseIndex,
    remoteSource?: ByteRangeSourceFactory
  ): void {
    this.#index = index
    this.#remoteSource = remoteSource ?? this.#remoteSource
    this.#incoming = undefined
    if (index.source) {
      this.#tree = undefined
      this.#sourceEntries.clear()
      this.#sourceTreeLoading = undefined
    }
    const liveData = new Set<string>()
    const liveDecoded = new Set<string>()
    const liveFrames = new Set<string>()
    const liveKeys = new Set<string>()
    const liveLoaders = new Map<string, Set<string>>()
    const retainFrame = (
      frame: SerializedFrameDescriptor,
      accessClassId: string
    ) => {
      liveFrames.add(frameCacheKey(frame))
      const key = loaderCacheKey(index, frame)
      const grants = liveLoaders.get(key) ?? new Set<string>()
      grants.add(accessClassId)
      liveLoaders.set(key, grants)
    }
    for (const entry of index.entries) {
      const frames = entry.frames
      if (!frames) continue
      liveKeys.add(frames.decodeKey)
      if (frames.data) {
        const key = frameCacheKey(frames.data)
        liveData.add(key)
        liveDecoded.add(key)
        retainFrame(frames.data, readAccessClass(entry.id))
      }
      if (frames.search) {
        liveDecoded.add(frameCacheKey(frames.search))
        retainFrame(frames.search, readAccessClass(entry.id))
      }
      if (frames.references) {
        liveDecoded.add(frameCacheKey(frames.references))
        retainFrame(frames.references, readAccessClass(entry.id))
      }
    }
    if (index.source?.treeFrame) {
      const source = index.source.treeFrame
      liveKeys.add(source.decodeKey)
      const bundleId = source.frame.bundleId ?? index.bundleId
      retainFrame(source.frame, `source:${bundleId}`)
    }
    for (const key of this.#entryData.keys())
      if (!liveData.has(key)) this.#entryData.delete(key)
    for (const key of this.#decoded.keys())
      if (!liveDecoded.has(key)) this.#decoded.delete(key)
    for (const key of this.#pendingBytes.keys())
      if (!liveFrames.has(key)) this.#pendingBytes.delete(key)
    for (const key of this.#keys.keys())
      if (!liveKeys.has(key)) this.#keys.delete(key)
    for (const [key, loader] of this.#loaders) {
      const grants = liveLoaders.get(key)
      if (!grants) this.#loaders.delete(key)
      else loader.retainGrants(grants)
    }
    if (index.source) this.#sourceOverlay.clear()
  }

  async cores(signal?: AbortSignal): Promise<ReadonlyArray<EntryCoreRecord>> {
    signal?.throwIfAborted()
    return this.#index.entries
  }

  async getTree(): Promise<ReadonlyTree> {
    if (this.#tree) return this.#tree
    this.#sourceTreeLoading ??= (async () => {
      const source = this.#index.source
      if (!source) throw new Error('Runtime index has no source tree')
      const bundleId = source.treeFrame.frame.bundleId ?? this.#index.bundleId
      const contents = await this.#loadBytes({
        descriptor: source.treeFrame.frame,
        decodeKey: source.treeFrame.decodeKey,
        id: 'source:tree',
        accessClassId: `source:${bundleId}`
      })
      const decoded = decodeRuntimeSourceTree(contents)
      this.#tree = decoded.tree
      this.#sourceEntries = new Map(decoded.entries)
      return this.#tree
    })()
    return this.#sourceTreeLoading
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    if (this.revision === sha) return undefined
    const tree = await this.getTree()
    return tree.sha === sha ? undefined : tree
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const source = this.#index.source
    if (!source) throw new Error('Runtime index has no source metadata')
    const loaded = new Map<string, Uint8Array>()
    const requested: Array<{
      sha: string
      frame: RuntimeFrameRequest
    }> = []
    const pending = new Set(shas)
    for (const sha of pending) {
      const overlay = this.#sourceOverlay.get(sha)
      if (!overlay) continue
      loaded.set(sha, overlay)
      pending.delete(sha)
    }
    if (pending.size > 0) await this.getTree()
    const entries = new Map<string, RuntimeIndexEntry>()
    for (const sha of pending) {
      const position = this.#sourceEntries.get(sha)
      const entry =
        position === undefined ? undefined : this.#index.entries[position]
      if (!entry) continue
      entries.set(sha, entry)
      pending.delete(sha)
    }
    for (const sha of shas) {
      if (loaded.has(sha)) continue
      const entry = entries.get(sha)
      if (entry?.frames?.data) {
        requested.push({
          sha,
          frame: entryFrame(entry, 'data')
        })
        continue
      }
      assert(entry, `Source entry not found: ${sha}`)
    }
    const contents = await this.#loadBytesMany(
      requested.map(item => item.frame)
    )
    for (const [index, item] of requested.entries())
      loaded.set(
        item.sha,
        decodeRuntimeSourceDataFrame(contents[index]).contents
      )
    for (const sha of shas) yield [sha, loaded.get(sha)!]
  }

  async applyChanges(batch: ChangesBatch): Promise<void> {
    const tree = await this.getTree()
    if (tree.sha !== batch.fromSha)
      throw new ShaMismatchError(batch.fromSha, tree.sha)
    const next = await tree.withChanges(batch)
    for (const change of batch.changes) {
      if (change.op === 'delete') continue
      assert(change.contents, `Missing contents for ${change.path}`)
      this.#sourceOverlay.set(change.sha, change.contents)
    }
    for (const sha of this.#sourceOverlay.keys())
      if (!next.hasSha(sha)) this.#sourceOverlay.delete(sha)
    this.#tree = next
  }

  load(
    core: EntryCoreRecord,
    signal?: AbortSignal
  ): Promise<Entry | undefined> {
    const cached = this.#entries.get(core)
    if (cached) return cached
    return this.loadMany([core], signal).then(entries => entries[0])
  }

  async loadMany(
    cores: ReadonlyArray<EntryCoreRecord>,
    signal?: AbortSignal
  ): Promise<Array<Entry | undefined>> {
    const values: Array<Promise<Entry | undefined> | Entry | undefined> =
      new Array(cores.length)
    const requests: Array<RuntimeFrameRequest> = []
    const positions: Array<number> = []
    for (const [position, core] of cores.entries()) {
      const entry = core as RuntimeIndexEntry
      const loaded = this.#entries.get(core)
      if (loaded) {
        values[position] = loaded
        continue
      }
      const descriptor = entry.frames?.data
      if (!descriptor) {
        const pending = Promise.resolve(exploreEntry(entry))
        this.#entries.set(core, pending)
        values[position] = pending
        continue
      }
      const cached = this.#entryData.get(frameCacheKey(descriptor))
      if (cached) {
        const pending = cached.then(frame => readEntry(entry, frame))
        this.#cacheEntry(core, pending)
        values[position] = pending
        continue
      }
      requests.push(entryFrame(entry, 'data'))
      positions.push(position)
    }
    const frames = this.#loadBytesMany(requests, signal)
    for (const [index, position] of positions.entries()) {
      const descriptor = requests[index].descriptor
      const entry = cores[position] as RuntimeIndexEntry
      const pending = frames.then(contents =>
        this.#dataFromContents(entry, contents[index])
      )
      this.#entryData.set(frameCacheKey(descriptor), pending)
      void pending.catch(() =>
        this.#entryData.delete(frameCacheKey(descriptor))
      )
      const loaded = pending.then(frame => readEntry(entry, frame))
      this.#cacheEntry(entry, loaded)
      values[position] = loaded
    }
    return Promise.all(values.map(value => Promise.resolve(value)))
  }

  #cacheEntry(
    core: EntryCoreRecord,
    pending: Promise<Entry | undefined>
  ): void {
    this.#entries.set(core, pending)
    void pending.catch(() => this.#entries.delete(core))
  }

  async search(
    core: EntryCoreRecord,
    audience: 'explore' | 'read',
    signal?: AbortSignal
  ): Promise<EntrySearchRecord | undefined> {
    const entry = core as RuntimeIndexEntry
    if (audience === 'explore') return exploreSearch(entry)
    const descriptor = entry.frames?.search
    if (!descriptor) return exploreSearch(entry)
    const frame = await this.#frame(
      entryFrame(entry, 'search'),
      decodeRuntimeSearchFrame,
      signal
    )
    return {
      kind: 'search',
      id: `runtime-search:read:${entry.id}`,
      entryVersionId: entry.id,
      audience,
      title: frame.title,
      searchableText: frame.searchableText
    }
  }

  async searchMany(
    cores: ReadonlyArray<EntryCoreRecord>,
    audience: 'explore' | 'read',
    signal?: AbortSignal
  ): Promise<Array<EntrySearchRecord | undefined>> {
    if (audience === 'explore')
      return Promise.all(cores.map(core => this.search(core, audience, signal)))
    const values: Array<EntrySearchRecord | undefined> = new Array(cores.length)
    const requests: Array<RuntimeFrameRequest> = []
    const positions: Array<number> = []
    for (const [position, core] of cores.entries()) {
      const entry = core as RuntimeIndexEntry
      const descriptor = entry.frames?.search
      if (!descriptor) {
        values[position] = exploreSearch(entry)
        continue
      }
      requests.push(entryFrame(entry, 'search'))
      positions.push(position)
    }
    const frames = await this.#frames(
      requests,
      decodeRuntimeSearchFrame,
      signal
    )
    for (const [index, frame] of frames.entries()) {
      const position = positions[index]
      const core = cores[position]
      values[position] = {
        kind: 'search',
        id: `runtime-search:read:${core.id}`,
        entryVersionId: core.id,
        audience,
        title: frame.title,
        searchableText: frame.searchableText
      }
    }
    return values
  }

  async *referencesFrom(
    sourceId: string,
    signal?: AbortSignal
  ): AsyncIterable<EntryLinkReference> {
    const entries = this.#index.entries.filter(
      entry => entry.entryId === sourceId && entry.frames?.references
    )
    for (const references of await this.#referencesMany(entries, signal))
      for (const reference of references) yield reference
  }

  async *referencesTo(
    targetId: string,
    signal?: AbortSignal
  ): AsyncIterable<EntryLinkReference> {
    this.#incoming ??= this.#buildIncoming(signal)
    for (const reference of (await this.#incoming).get(targetId) ?? [])
      yield reference
  }

  async #referencesMany(
    entries: ReadonlyArray<RuntimeIndexEntry>,
    signal?: AbortSignal
  ): Promise<Array<ReadonlyArray<EntryLinkReference>>> {
    const frames = await this.#frames(
      entries.map(entry => ({
        ...entryFrame(entry, 'references')
      })),
      decodeRuntimeReferenceFrame,
      signal
    )
    return frames.map((frame, index) =>
      this.#referenceMetadata(entries[index], frame)
    )
  }

  #referenceMetadata(
    entry: RuntimeIndexEntry,
    frame: RuntimeReferenceFrame
  ): ReadonlyArray<EntryLinkReference> {
    return frame.references.map(reference => ({
      ...reference,
      sourceEntryId: entry.entryId,
      sourceVersionId: entry.id,
      sourceFilePath: frame.sourceFilePath,
      sourceType: entry.type,
      sourceLocale: entry.locale,
      sourceStatus: entry.status,
      sourceActive: entry.active,
      sourceMain: entry.main
    }))
  }

  async #buildIncoming(
    signal?: AbortSignal
  ): Promise<ReadonlyMap<string, ReadonlyArray<EntryLinkReference>>> {
    const entries = this.#index.entries.filter(
      entry => entry.frames?.references
    )
    const frames = await this.#referencesMany(entries, signal)
    const incoming = new Map<string, Array<EntryLinkReference>>()
    for (const references of frames)
      for (const reference of references) {
        const bucket = incoming.get(reference.targetId) ?? []
        bucket.push(reference)
        incoming.set(reference.targetId, bucket)
      }
    return incoming
  }

  #frame<Value>(
    request: RuntimeFrameRequest,
    decode: (contents: Uint8Array) => Value,
    signal?: AbortSignal
  ): Promise<Value> {
    const cacheKey = frameCacheKey(request.descriptor)
    let pending = this.#decoded.get(cacheKey) as Promise<Value> | undefined
    if (!pending) {
      pending = this.#decode(request, decode, signal)
      this.#decoded.set(cacheKey, pending)
      void pending.catch(() => this.#decoded.delete(cacheKey))
    }
    return pending
  }

  async #frames<Value>(
    requests: ReadonlyArray<RuntimeFrameRequest>,
    decode: (contents: Uint8Array) => Value,
    signal?: AbortSignal
  ): Promise<Array<Value>> {
    const values = new Array<Promise<Value> | Value>(requests.length)
    const missing: Array<RuntimeFrameRequest> = []
    const positions: Array<number> = []
    for (const [position, request] of requests.entries()) {
      const cacheKey = frameCacheKey(request.descriptor)
      const cached = this.#decoded.get(cacheKey) as Promise<Value> | undefined
      if (cached) {
        values[position] = cached
        continue
      }
      missing.push(request)
      positions.push(position)
    }
    const contents = await this.#loadBytesMany(missing, signal)
    for (const [index, bytes] of contents.entries()) {
      const position = positions[index]
      const value = decode(bytes)
      values[position] = value
      this.#decoded.set(
        frameCacheKey(requests[position].descriptor),
        Promise.resolve(value)
      )
    }
    return Promise.all(values.map(value => Promise.resolve(value)))
  }

  async #loadBytesMany(
    requests: ReadonlyArray<RuntimeFrameRequest>,
    signal?: AbortSignal
  ): Promise<Array<Uint8Array>> {
    const values = new Array<Promise<Uint8Array> | Uint8Array>(requests.length)
    const groups = new Map<
      BundleFrameLoader,
      Array<{position: number; frame: FrameDescriptor}>
    >()
    for (const [position, request] of requests.entries()) {
      const {loader, frame} = this.#prepareFrame(
        request.descriptor,
        request.decodeKey,
        request.id,
        request.accessClassId
      )
      const group = groups.get(loader) ?? []
      group.push({position, frame})
      groups.set(loader, group)
    }
    await Promise.all(
      [...groups].map(async ([loader, group]) => {
        const loaded = await loader.loadMany(
          group.map(item => item.frame),
          signal
        )
        for (const item of group) {
          const contents = loaded.get(item.frame.id)
          assert(contents, `Missing decoded frame "${item.frame.id}"`)
          values[item.position] = contents
        }
      })
    )
    return Promise.all(values.map(value => Promise.resolve(value)))
  }

  async #decode<Value>(
    request: RuntimeFrameRequest,
    decode: (contents: Uint8Array) => Value,
    signal?: AbortSignal
  ): Promise<Value> {
    const contents = await this.#loadBytes(request, signal)
    return decode(contents)
  }

  #dataFromContents(
    entry: RuntimeIndexEntry,
    contents: Uint8Array
  ): RuntimeDataFrame {
    const source = decodeRuntimeSourceDataFrame(contents)
    const {data} = parseRecord(
      JSON.parse(this.#decoder.decode(source.contents))
    )
    const parentDir = runtimeParentDirFromPath(source.filePath)
    return {
      filePath: source.filePath,
      parentDir,
      childrenDir: runtimeChildrenDirFromPath(parentDir, entry.path),
      rowHash: source.fileHash,
      fileHash: source.fileHash,
      data: {path: entry.path, ...source.dataDefaults, ...data}
    }
  }

  #loadBytes(
    request: RuntimeFrameRequest,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const cacheKey = frameCacheKey(request.descriptor)
    let pending = this.#pendingBytes.get(cacheKey)
    if (!pending) {
      pending = this.#readBytes(request, signal)
      this.#pendingBytes.set(cacheKey, pending)
      void pending.then(
        () => this.#pendingBytes.delete(cacheKey),
        () => this.#pendingBytes.delete(cacheKey)
      )
    }
    return pending
  }

  async #readBytes(
    request: RuntimeFrameRequest,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const {loader, frame} = this.#prepareFrame(
      request.descriptor,
      request.decodeKey,
      request.id,
      request.accessClassId
    )
    return loader.load(frame, signal)
  }

  #prepareFrame(
    serialized: SerializedFrameDescriptor,
    decodeKey: string,
    id: string,
    accessClassId: string
  ): {loader: BundleFrameLoader; frame: FrameDescriptor} {
    const frame = deserializeFrame(serialized, id, accessClassId)
    const bundleId = frame.bundleId ?? this.#index.bundleId
    const bundleUrl = frame.bundleUrl ?? this.#index.bundleUrl
    const loaderKey = `${bundleId}\0${bundleUrl}`
    let loader = this.#loaders.get(loaderKey)
    if (!loader) {
      const source =
        bundleUrl === this.#baseBundleUrl || !this.#remoteSource
          ? this.#source(bundleUrl)
          : this.#remoteSource(bundleUrl)
      loader = new BundleFrameLoader(bundleId, source, [])
      this.#loaders.set(loaderKey, loader)
    }
    let key = this.#keys.get(decodeKey)
    if (!key) {
      key = base64url.parse(decodeKey, {loose: true})
      this.#keys.set(decodeKey, key)
    }
    loader.grant(frame.accessClassId, key)
    return {loader, frame}
  }
}

function runtimeParentDirFromPath(filePath: string): string {
  return dirname(filePath)
}

function runtimeChildrenDirFromPath(parentDir: string, path: string): string {
  return join(parentDir, path)
}

interface RuntimeFrameRequest {
  descriptor: SerializedFrameDescriptor
  decodeKey: string
  id: string
  accessClassId: string
}

function frameCacheKey(frame: SerializedFrameDescriptor): string {
  return `${frame.bundleId ?? ''}\0${frame.nonce}`
}

function loaderCacheKey(
  index: RuntimeDatabaseIndex,
  frame: SerializedFrameDescriptor
): string {
  return `${frame.bundleId ?? index.bundleId}\0${frame.bundleUrl ?? index.bundleUrl}`
}

function entryFrame(
  entry: RuntimeIndexEntry,
  kind: 'data' | 'search' | 'references'
): RuntimeFrameRequest {
  const frames = entry.frames
  const descriptor = frames?.[kind]
  assert(frames && descriptor, `Entry "${entry.id}" has no ${kind} frame`)
  return {
    descriptor,
    decodeKey: frames.decodeKey,
    id: `${kind}:${entry.id}`,
    accessClassId: readAccessClass(entry.id)
  }
}

function exploreSearch(entry: RuntimeIndexEntry): EntrySearchRecord {
  return {
    kind: 'search',
    id: `runtime-search:explore:${entry.id}`,
    entryVersionId: entry.id,
    audience: 'explore',
    title: entry.title,
    searchableText: `${entry.title} ${entry.path} ${entry.url}`
  }
}

function exploreEntry(core: RuntimeIndexEntry): Entry {
  return {
    id: core.entryId,
    versionStatus: core.versionStatus,
    status: core.status,
    title: core.title,
    type: core.type,
    seeded: core.seeded,
    workspace: core.workspace,
    root: core.root,
    level: core.level,
    filePath: '',
    parentDir: '',
    childrenDir: '',
    index: core.index,
    parentId: core.parentId,
    parents: [...core.parents],
    locale: core.locale,
    rowHash: '',
    active: core.active,
    main: core.main,
    path: core.path,
    fileHash: '',
    url: core.url,
    data: {},
    searchableText: ''
  }
}

function readEntry(core: RuntimeIndexEntry, frame: RuntimeDataFrame): Entry {
  return {
    ...exploreEntry(core),
    filePath: frame.filePath,
    parentDir: frame.parentDir,
    childrenDir: frame.childrenDir,
    rowHash: frame.rowHash,
    fileHash: frame.fileHash,
    data: frame.data
  }
}
