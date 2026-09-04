import type {Entry} from '#/core/Entry.js'
import {parseRecord} from '#/core/EntryRecord.js'
import type {ChangesBatch} from '#/core/source/Change.js'
import {ShaMismatchError} from '#/core/source/ShaMismatchError.js'
import type {Source} from '#/core/source/Source.js'
import {ReadonlyTree} from '#/core/source/Tree.js'
import {assert} from '#/core/util/Assert.js'
import {base64url} from '#/core/util/Encoding.js'
import type {EntryCoreRecord, EntrySearchRecord} from '../entry/Model.js'
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
  #decoded = new Map<string, Promise<unknown>>()
  #keys = new Map<string, Uint8Array>()
  #incoming?: Promise<ReadonlyMap<string, ReadonlyArray<EntryLinkReference>>>
  #decoder = new TextDecoder()
  #tree?: ReadonlyTree
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
    if (index.source) this.#tree = undefined
    const liveData = new Set<string>()
    const liveDecoded = new Set<string>()
    const liveKeys = new Set<string>()
    for (const entry of index.entries) {
      const frames = entry.frames
      if (!frames) continue
      liveKeys.add(frames.decodeKey)
      if (frames.data) {
        const key = frameCacheKey(frames.data)
        liveData.add(key)
        liveDecoded.add(key)
      }
      if (frames.search) liveDecoded.add(frameCacheKey(frames.search))
      if (frames.references) liveDecoded.add(frameCacheKey(frames.references))
    }
    for (const source of Object.values(index.source?.blobs ?? {}))
      liveKeys.add(source.decodeKey)
    for (const key of this.#entryData.keys())
      if (!liveData.has(key)) this.#entryData.delete(key)
    for (const key of this.#decoded.keys())
      if (!liveDecoded.has(key)) this.#decoded.delete(key)
    for (const key of this.#keys.keys())
      if (!liveKeys.has(key)) this.#keys.delete(key)
  }

  async cores(signal?: AbortSignal): Promise<ReadonlyArray<EntryCoreRecord>> {
    signal?.throwIfAborted()
    return this.#index.entries
  }

  async getTree(): Promise<ReadonlyTree> {
    if (!this.#tree) {
      const source = this.#index.source
      if (!source) throw new Error('Runtime index has no source tree')
      this.#tree = new ReadonlyTree(source.tree)
    }
    return this.#tree
  }

  async getTreeIfDifferent(sha: string): Promise<ReadonlyTree | undefined> {
    const tree = await this.getTree()
    return tree.sha === sha ? undefined : tree
  }

  async *getBlobs(
    shas: Array<string>
  ): AsyncGenerator<[sha: string, blob: Uint8Array]> {
    const source = this.#index.source
    if (!source) throw new Error('Runtime index has no source blobs')
    const loaded = new Map<string, Uint8Array>()
    const requested: Array<{sha: string; frame: RuntimeFrameRequest}> = []
    for (const sha of shas) {
      const overlay = this.#sourceOverlay.get(sha)
      if (overlay) {
        loaded.set(sha, overlay)
        continue
      }
      const blob = source.blobs[sha]
      assert(blob, `Source blob not found: ${sha}`)
      requested.push({
        sha,
        frame: {descriptor: blob.frame, decodeKey: blob.decodeKey}
      })
    }
    const contents = await this.#loadBytesMany(
      requested.map(item => item.frame)
    )
    for (const [index, item] of requested.entries())
      loaded.set(item.sha, contents[index])
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
    const entry = core as RuntimeIndexEntry
    const data = entry.frames?.data
    if (!data) return Promise.resolve(exploreEntry(entry))
    const cacheKey = frameCacheKey(data)
    let pending = this.#entryData.get(cacheKey)
    if (!pending) {
      pending = this.#loadBytes(data, entry.frames!.decodeKey, signal).then(
        contents => this.#dataFromContents(entry, contents)
      )
      this.#entryData.set(cacheKey, pending)
      void pending.catch(() => this.#entryData.delete(cacheKey))
    }
    return pending.then(frame => readEntry(entry, frame))
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
      const descriptor = entry.frames?.data
      if (!descriptor) {
        values[position] = exploreEntry(entry)
        continue
      }
      const cached = this.#entryData.get(frameCacheKey(descriptor))
      if (cached) {
        values[position] = cached.then(frame => readEntry(entry, frame))
        continue
      }
      requests.push({descriptor, decodeKey: entry.frames!.decodeKey})
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
      values[position] = pending.then(frame => readEntry(entry, frame))
    }
    return Promise.all(values.map(value => Promise.resolve(value)))
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
    const frame = await this.#frame<RuntimeSearchFrame>(
      descriptor,
      entry.frames!.decodeKey,
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
      requests.push({descriptor, decodeKey: entry.frames!.decodeKey})
      positions.push(position)
    }
    const frames = await this.#frames<RuntimeSearchFrame>(requests, signal)
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
    const frames = await this.#frames<RuntimeReferenceFrame>(
      entries.map(entry => ({
        descriptor: entry.frames!.references!,
        decodeKey: entry.frames!.decodeKey
      })),
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
    serialized: SerializedFrameDescriptor,
    decodeKey: string,
    signal?: AbortSignal
  ): Promise<Value> {
    const cacheKey = `${serialized.id}\0${serialized.cipherHash}`
    let pending = this.#decoded.get(cacheKey) as Promise<Value> | undefined
    if (!pending) {
      pending = this.#decode<Value>(serialized, decodeKey, signal)
      this.#decoded.set(cacheKey, pending)
      void pending.catch(() => this.#decoded.delete(cacheKey))
    }
    return pending
  }

  async #frames<Value>(
    requests: ReadonlyArray<RuntimeFrameRequest>,
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
      const value = JSON.parse(this.#decoder.decode(bytes)) as Value
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
        request.decodeKey
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
    serialized: SerializedFrameDescriptor,
    decodeKey: string,
    signal?: AbortSignal
  ): Promise<Value> {
    const contents = await this.#loadBytes(serialized, decodeKey, signal)
    return JSON.parse(this.#decoder.decode(contents)) as Value
  }

  #dataFromContents(
    entry: RuntimeIndexEntry,
    contents: Uint8Array
  ): RuntimeDataFrame {
    if (entry.frames?.dataFormat === 'source') {
      const read = entry.frames.read
      assert(read, `Entry "${entry.id}" is missing read metadata`)
      const {data} = parseRecord(JSON.parse(this.#decoder.decode(contents)))
      return {
        ...read,
        data: {path: entry.path, ...read.dataDefaults, ...data}
      }
    }
    return JSON.parse(this.#decoder.decode(contents)) as RuntimeDataFrame
  }

  #loadBytes(
    serialized: SerializedFrameDescriptor,
    decodeKey: string,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const cacheKey = frameCacheKey(serialized)
    let pending = this.#pendingBytes.get(cacheKey)
    if (!pending) {
      pending = this.#readBytes(serialized, decodeKey, signal)
      this.#pendingBytes.set(cacheKey, pending)
      void pending.then(
        () => this.#pendingBytes.delete(cacheKey),
        () => this.#pendingBytes.delete(cacheKey)
      )
    }
    return pending
  }

  async #readBytes(
    serialized: SerializedFrameDescriptor,
    decodeKey: string,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const {loader, frame} = this.#prepareFrame(serialized, decodeKey)
    return loader.load(frame, signal)
  }

  #prepareFrame(
    serialized: SerializedFrameDescriptor,
    decodeKey: string
  ): {loader: BundleFrameLoader; frame: FrameDescriptor} {
    const frame = deserializeFrame(serialized)
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

interface RuntimeFrameRequest {
  descriptor: SerializedFrameDescriptor
  decodeKey: string
}

function frameCacheKey(frame: SerializedFrameDescriptor): string {
  return `${frame.id}\0${frame.cipherHash}`
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
