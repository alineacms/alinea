import {Config} from './Config.js'
import {Connection} from './Connection.js'
import {Schema} from './Schema.js'
import {Type} from './Type.js'
import {Cursor} from './pages/Cursor.js'
import {Projection} from './pages/Projection.js'
import {Selection} from './pages/Selection.js'
import {seralizeLocation, serializeSelection} from './pages/Serialize.js'

export interface GraphApi {
  get<S extends Projection>(select: S): Promise<Projection.InferOne<S>>
  get<S extends Projection>(
    location: Location,
    select: S
  ): Promise<Projection.InferOne<S>>
  find<S>(select: S): Promise<Selection.Infer<S>>
  find<S>(location: Location, select: S): Promise<Selection.Infer<S>>
  count(cursor: Cursor.Find<any>): Promise<number>
  count(location: Location, cursor: Cursor.Find<any>): Promise<number>
}

export class Graph implements GraphApi {
  #config: Config
  targets: Schema.Targets

  constructor(
    config: Config,
    public resolve: (params: Connection.ResolveParams) => Promise<unknown>
  ) {
    this.#config = config
    this.targets = Schema.targets(config.schema)
  }

  get<S extends Projection>(select: S): Promise<Projection.InferOne<S>>
  get<S extends Projection>(
    location: Location,
    select: S
  ): Promise<Projection.InferOne<S>>
  async get(...args: Array<any>): Promise<any> {
    let [providedLocation, select] =
      args.length === 1 ? [undefined, args[0]] : args
    if (select instanceof Cursor.Find) select = select.first()
    if (Type.isType(select)) select = select().first()
    const selection = Selection.create(select)
    serializeSelection(this.targets, selection)
    return this.resolve({
      selection,
      location: seralizeLocation(this.#config, providedLocation)
    })
  }

  find<S>(select: S): Promise<Selection.Infer<S>>
  find<S>(location: Location, select: S): Promise<Selection.Infer<S>>
  async find(...args: Array<any>): Promise<any> {
    const [providedLocation, select] =
      args.length === 1 ? [undefined, args[0]] : args
    const selection = Selection.create(select)
    serializeSelection(this.targets, selection)
    return this.resolve({
      selection,
      location: seralizeLocation(this.#config, providedLocation)
    })
  }

  count(cursor: Cursor.Find<any>): Promise<number>
  count(location: Location, cursor: Cursor.Find<any>): Promise<number>
  async count(...args: Array<any>): Promise<any> {
    let [providedLocation, cursor] =
      args.length === 1 ? [undefined, args[0]] : args
    const selection = Selection.create(cursor.count())
    serializeSelection(this.targets, selection)
    return this.resolve({
      selection,
      location: seralizeLocation(this.#config, providedLocation)
    })
  }
}
