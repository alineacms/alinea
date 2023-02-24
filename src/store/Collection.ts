import {CursorImpl} from './Cursor.js'
import {Expr, ExprData} from './Expr.js'
import {Fields} from './Fields.js'
import {From} from './From.js'
import {Selection, SelectionInput} from './Selection.js'
import type {Store} from './Store.js'

export type CollectionOptions = {
  flat?: boolean
  columns?: Array<string>
  where?: Expr<boolean>
  alias?: string
  computed?: (collection: Fields<any>) => Record<string, Expr<any>>
  id?: CollectionId
}

interface CollectionId {
  property: string
  addToRow: (row: any, id: string) => any
  getFromRow: (row: any) => string
}

export class CollectionImpl<Row = any> extends CursorImpl<Row> {
  private __options: CollectionOptions
  __collectionId: CollectionId
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
    this.__collectionId = options?.id || {
      property: 'id',
      addToRow: (row, id) => Object.assign({id}, row),
      getFromRow: row => row.id
    }
  }

  pick<Props extends Array<keyof Row>>(
    ...properties: Props
  ): Selection<{
    [K in Props[number]]: Row[K]
  }> {
    const fields: Record<string, ExprData> = {}
    for (const prop of properties)
      fields[prop as string] = this.get(prop as string).expr
    return new Selection<{
      [K in Props[number]]: Row[K]
    }>(ExprData.Record(fields))
  }

  get id() {
    return this.get(this.__collectionId.property) as Expr<string>
  }

  with<X extends SelectionInput>(that: X): Selection.With<Row, X> {
    return this.fields.with(that)
  }

  as<T = Row>(name: string): Collection<T> {
    return new Collection<T>(From.source(this.cursor.from), {
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
    return new Collection<Row & Store.TypeOf<F>>(
      From.source(collection.cursor.from),
      {
        ...collection.__options,
        computed: createFields as any
      }
    )
  }
}

export interface CollectionConstructor {
  new <Row>(name: string, options?: CollectionOptions): Collection<Row>
  extend: typeof CollectionImpl.extend
}

export type Collection<T> = CollectionImpl<T> & Fields<T>

export const Collection = CollectionImpl as CollectionConstructor
