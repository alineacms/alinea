import {Config} from './Config.js'
import {Entry} from './Entry.js'
import {PageSeed} from './Page.js'
import {ResolveRequest, Resolver} from './Resolver.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Workspace} from './Workspace.js'
import {createSelection} from './pages/CreateSelection.js'
import {Cursor} from './pages/Cursor.js'
import type {Projection} from './pages/Projection.js'
import {Realm} from './pages/Realm.js'
import {Selection} from './pages/ResolveData.js'
import {seralizeLocation, serializeSelection} from './pages/Serialize.js'

export type Location = Root | Workspace | PageSeed

export interface GraphRealmApi {
  /** Filter results by location */
  in(location: Location): GraphRealmApi
  /** Filter results by locale */
  locale(locale: string): GraphRealmApi
  /** Find a single entry or null */
  maybeGet<S extends Projection | Type>(
    select: S
  ): Promise<Projection.InferOne<S> | null>
  /** Preview an entry */
  previewEntry(entry: Entry): GraphRealmApi
  /** Find a single entry */
  get<S extends Projection | Type>(select: S): Promise<Projection.InferOne<S>>
  /** Find a set of entries */
  find<S extends Projection | Type>(select: S): Promise<Selection.Infer<S>>
  /** The time in seconds to poll for updates to content */
  syncInterval(interval: number): GraphRealmApi
  /** Disable polling for updates to content */
  disableSync(): GraphRealmApi
  /** The amount of results found */
  count(cursor: Cursor.Find<any>): Promise<number>
}

export interface GraphOrigin {
  location?: Location
  locale?: string
}

export class GraphRealm implements GraphRealmApi {
  #resolver: Resolver
  #config: Config
  #targets: Schema.Targets
  #params: Partial<ResolveRequest>

  constructor(
    config: Config,
    resolver: Resolver,
    params?: Partial<ResolveRequest>
  ) {
    this.#config = config
    this.#resolver = resolver
    this.#targets = Schema.targets(config.schema)
    this.#params = {...params}
  }

  disableSync() {
    return new GraphRealm(this.#config, this.#resolver, {
      ...this.#params,
      syncInterval: Infinity
    })
  }

  syncInterval(interval: number) {
    return new GraphRealm(this.#config, this.#resolver, {
      ...this.#params,
      syncInterval: interval
    })
  }

  in(location: Location): GraphRealmApi {
    return new GraphRealm(this.#config, this.#resolver, {
      ...this.#params,
      location: seralizeLocation(this.#config, location)
    })
  }

  locale(locale: string) {
    return new GraphRealm(this.#config, this.#resolver, {
      ...this.#params,
      locale
    })
  }

  previewEntry(entry: Entry): GraphRealmApi {
    return new GraphRealm(this.#config, this.#resolver, {
      ...this.#params,
      preview: {entry}
    })
  }

  maybeGet<S extends Projection | Type>(
    select: S
  ): Promise<Projection.InferOne<S> | null>
  async maybeGet(select: any) {
    if (select instanceof Cursor.Find) select = select.first()
    if (Type.isType(select)) select = select().first()
    const selection = createSelection(select)
    serializeSelection(this.#targets, selection)
    return this.#resolver.resolve({
      ...this.#params,
      selection
    })
  }

  get<S extends Projection | Type>(select: S): Promise<Projection.InferOne<S>>
  async get(select: any) {
    const result = this.maybeGet(select)
    if (result === null) throw new Error('Not found')
    return result
  }

  find<S extends Projection | Type>(select: S): Promise<Selection.Infer<S>>
  async find(select: any) {
    const selection = createSelection(select)
    serializeSelection(this.#targets, selection)
    return this.#resolver.resolve({
      ...this.#params,
      selection
    })
  }

  count(cursor: Cursor.Find<any>): Promise<number>
  async count(cursor: Cursor.Find<any>) {
    const selection = createSelection(cursor.count())
    serializeSelection(this.#targets, selection)
    return this.#resolver.resolve({
      ...this.#params,
      selection
    })
  }
}

export class Graph {
  drafts: GraphRealm
  archived: GraphRealm
  published: GraphRealm
  preferPublished: GraphRealm
  preferDraft: GraphRealm
  all: GraphRealm

  constructor(public config: Config, public resolver: Resolver) {
    this.drafts = new GraphRealm(this.config, resolver, {realm: Realm.Draft})
    this.archived = new GraphRealm(this.config, resolver, {
      realm: Realm.Archived
    })
    this.published = new GraphRealm(this.config, resolver, {
      realm: Realm.Published
    })
    this.preferDraft = new GraphRealm(this.config, resolver, {
      realm: Realm.PreferDraft
    })
    this.preferPublished = new GraphRealm(this.config, resolver, {
      realm: Realm.PreferPublished
    })
    this.all = new GraphRealm(this.config, resolver, {realm: Realm.All})
  }
}
