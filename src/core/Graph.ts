import {Config} from './Config.js'
import {Connection} from './Connection.js'
import {PageSeed} from './Page.js'
import {Root} from './Root.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Workspace} from './Workspace.js'
import {Cursor} from './pages/Cursor.js'
import {Projection} from './pages/Projection.js'
import {Selection} from './pages/Selection.js'
import {seralizeLocation, serializeSelection} from './pages/Serialize.js'

export type Location = Root | Workspace | PageSeed

export interface GraphApi {
  in(location: Location): GraphApi
  locale(locale: string): GraphApi
  maybeGet<S extends Projection>(
    select: S
  ): Promise<Projection.InferOne<S> | null>
  get<S extends Projection>(select: S): Promise<Projection.InferOne<S>>
  find<S>(select: S): Promise<Selection.Infer<S>>
  count(cursor: Cursor.Find<any>): Promise<number>
}

export interface GraphOrigin {
  location?: Location
  locale?: string
}

export class Graph implements GraphApi {
  targets: Schema.Targets

  constructor(
    protected config: Config,
    private resolve: (params: Connection.ResolveParams) => Promise<unknown>,
    private origin: GraphOrigin = {}
  ) {
    this.targets = Schema.targets(config.schema)
  }

  in(location: Location): GraphApi {
    // Should this reset locale?
    return new Graph(this.config, this.resolve, {...this.origin, location})
  }

  locale(locale: string) {
    return new Graph(this.config, this.resolve, {
      ...this.origin,
      locale
    })
  }

  maybeGet<S extends Projection>(
    select: S
  ): Promise<Projection.InferOne<S> | null>
  async maybeGet(select: any) {
    if (select instanceof Cursor.Find) select = select.first()
    if (Type.isType(select)) select = select().first()
    const selection = Selection.create(select)
    serializeSelection(this.targets, selection)
    return this.resolve({
      selection,
      location: seralizeLocation(this.config, this.origin.location),
      locale: this.origin.locale
    })
  }

  get<S extends Projection>(select: S): Promise<Projection.InferOne<S>>
  async get(select: any) {
    const result = this.maybeGet(select)
    if (result === null) throw new Error('Not found')
    return result
  }

  find<S>(select: S): Promise<Selection.Infer<S>>
  async find(select: any) {
    const selection = Selection.create(select)
    serializeSelection(this.targets, selection)
    return this.resolve({
      selection,
      location: seralizeLocation(this.config, this.origin.location),
      locale: this.origin.locale
    })
  }

  count(cursor: Cursor.Find<any>): Promise<number>
  async count(cursor: Cursor.Find<any>) {
    const selection = Selection.create(cursor.count())
    serializeSelection(this.targets, selection)
    return this.resolve({
      selection,
      location: seralizeLocation(this.config, this.origin.location),
      locale: this.origin.locale
    })
  }
}
