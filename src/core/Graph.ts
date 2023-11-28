import {Config} from './Config.js'
import {Connection} from './Connection.js'
import {PageSeed} from './Page.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Workspace} from './Workspace.js'
import {createSelection} from './pages/CreateSelection.js'
import {Cursor} from './pages/Cursor.js'
import {Projection} from './pages/Projection.js'
import {Realm} from './pages/Realm.js'
import {Selection} from './pages/Selection.js'
import {seralizeLocation, serializeSelection} from './pages/Serialize.js'

export type Location = Root | Workspace | PageSeed

export interface GraphRealmApi {
  in(location: Location): GraphRealmApi
  locale(locale: string): GraphRealmApi
  maybeGet<S extends Projection | Type>(
    select: S
  ): Promise<Projection.InferOne<S> | null>
  get<S extends Projection | Type>(select: S): Promise<Projection.InferOne<S>>
  find<S extends Projection | Type>(select: S): Promise<Selection.Infer<S>>
  count(cursor: Cursor.Find<any>): Promise<number>
}

export interface GraphOrigin {
  location?: Location
  locale?: string
}

export class GraphRealm implements GraphRealmApi {
  targets: Schema.Targets

  constructor(
    protected config: Config,
    private resolve: (params: Connection.ResolveParams) => Promise<unknown>,
    private origin: GraphOrigin = {}
  ) {
    this.targets = Schema.targets(config.schema)
  }

  in(location: Location): GraphRealmApi {
    // Should this reset locale?
    return new GraphRealm(this.config, this.resolve, {...this.origin, location})
  }

  locale(locale: string) {
    return new GraphRealm(this.config, this.resolve, {
      ...this.origin,
      locale
    })
  }

  maybeGet<S extends Projection | Type>(
    select: S
  ): Promise<Projection.InferOne<S> | null>
  async maybeGet(select: any) {
    if (select instanceof Cursor.Find) select = select.first()
    if (Type.isType(select)) select = select().first()
    const selection = createSelection(select)
    serializeSelection(this.targets, selection)
    return this.resolve({
      selection,
      location: seralizeLocation(this.config, this.origin.location),
      locale: this.origin.locale
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
    serializeSelection(this.targets, selection)
    return this.resolve({
      selection,
      location: seralizeLocation(this.config, this.origin.location),
      locale: this.origin.locale
    })
  }

  count(cursor: Cursor.Find<any>): Promise<number>
  async count(cursor: Cursor.Find<any>) {
    const selection = createSelection(cursor.count())
    serializeSelection(this.targets, selection)
    return this.resolve({
      selection,
      location: seralizeLocation(this.config, this.origin.location),
      locale: this.origin.locale
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

  constructor(
    public config: Config,
    public resolve: (params: Connection.ResolveParams) => Promise<unknown>
  ) {
    this.drafts = new GraphRealm(this.config, params => {
      return this.resolve({
        ...params,
        realm: Realm.Draft
      })
    })
    this.archived = new GraphRealm(config, params => {
      return resolve({
        ...params,
        realm: Realm.Archived
      })
    })
    this.published = new GraphRealm(config, params => {
      return resolve({
        ...params,
        realm: Realm.Published
      })
    })
    this.preferDraft = new GraphRealm(config, params => {
      return resolve({
        ...params,
        realm: Realm.PreferDraft
      })
    })
    this.preferPublished = new GraphRealm(config, params => {
      return resolve({
        ...params,
        realm: Realm.PreferPublished
      })
    })
    this.all = new GraphRealm(config, params => {
      return resolve({
        ...params,
        realm: Realm.All
      })
    })
  }
}
