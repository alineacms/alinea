import {CursorImpl} from './Cursor'
import {Expr, ExprData} from './Expr'
import {Fields} from './Fields'
import {From} from './From'
import {Selection, SelectionInput} from './Selection'
import type {Store} from './Store'

export type CollectionOptions = {
  flat?: boolean
  columns?: Array<string>
  where?: Expr<boolean>
  alias?: string
  computed?: (collection: Fields<any>) => Record<string, Expr<any>>
}

export class CollectionImpl<Row extends {} = any> extends CursorImpl<Row> {
  private __options: CollectionOptions
  constructor(name: string, options: CollectionOptions = {}) {
    const {flat, columns, where, alias, computed} = options
    const from = flat
      ? From.Table(name, columns || [], alias)
      : From.Column(From.Table(name, ['data'], alias), 'data')
    const row = ExprData.Row(from)
    const selection = computed
      ? ExprData.Merge(row, ExprData.create(computed(Fields.create(row))))
      : row
    super({
      from,
      selection,
      where: where?.expr
    })
    this.__options = options
  }

  pick<Props extends Array<keyof Row>>(
    ...properties: Props
  ): Selection<{
    [K in Props[number]]: Row[K]
  }> {
    const fields: Record<string, ExprData> = {}
    for (const prop of properties)
      fields[prop as string] = this.get(prop as string).expr
    return new Selection(ExprData.Record(fields))
  }

  get id() {
    return this.get('id') as Expr<string>
  }

  with<X extends SelectionInput>(that: X): Selection.With<Row, X> {
    return this.fields.with(that)
  }

  as<T = Row>(name: string): Collection<T> {
    return new Collection(From.source(this.cursor.from), {
      ...this.__options,
      alias: name
    })
  }

  /*on() {
    throw new Error('Not implemented')
  }*/

  static extend<Row, F extends Record<string, Expr<any>>>(
    collection: Collection<Row>,
    createFields: (current: Fields<Row>) => F
  ): Collection<Row & Store.TypeOf<F>> {
    return new Collection(From.source(collection.cursor.from), {
      ...collection.__options,
      computed: createFields as any
    })
  }
}

export interface CollectionConstructor {
  new <Row>(name: string, options?: CollectionOptions): Collection<Row>
  extend: typeof CollectionImpl.extend
}

export type Collection<T> = CollectionImpl<T> & Fields<T>

export const Collection = CollectionImpl as CollectionConstructor
