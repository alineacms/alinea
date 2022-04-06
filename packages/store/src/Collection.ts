import {CursorImpl} from './Cursor'
import {Expr, ExprData} from './Expr'
import {Fields} from './Fields'
import {From} from './From'
import {Selection, SelectionData} from './Selection'
import type {Store} from './Store'

export type CollectionOptions = {
  flat?: boolean
  columns?: Array<string>
  where?: Expr<boolean>
  alias?: string
  computed?: Record<string, Expr<any>>
}

export class CollectionImpl<Row extends {} = any> extends CursorImpl<Row> {
  constructor(name: string, options: CollectionOptions = {}) {
    const {flat, columns, where, alias, computed} = options
    const from = flat
      ? From.Table(name, columns || [], alias)
      : From.Column(From.Table(name, ['data'], alias), 'data')
    const row = ExprData.Row(from)
    const selection = computed
      ? SelectionData.Expr(ExprData.Merge(row, ExprData.create(computed)))
      : SelectionData.Expr(row)
    super({
      from,
      selection,
      where: where?.expr
    })
    this.define = createFields =>
      new Collection(name, {
        ...options,
        computed: createFields(this as Fields<Row>)
      })
  }

  pick<Props extends Array<keyof Row>>(
    ...properties: Props
  ): Selection<{
    [K in Props[number]]: Row[K]
  }> {
    const fields: Record<string, ExprData> = {}
    for (const prop of properties)
      fields[prop as string] = this.get(prop as string).expr
    return new Selection(SelectionData.Expr(ExprData.Record(fields)))
  }

  get id() {
    return this.get('id') as Expr<string>
  }

  as(name: string): Collection<Row> {
    return new Collection(From.source(this.cursor.from), {
      alias: name,
      where: this.cursor.where ? new Expr(this.cursor.where) : undefined
    })
  }

  define: <F extends Record<string, Expr<any>>>(
    createFields: (current: Fields<Row>) => F
  ) => CollectionImpl<Row> & Fields<Row & Store.TypeOf<F>>
}

export interface CollectionConstructor {
  new <Row>(name: string, options?: CollectionOptions): Collection<Row>
}

export type Collection<T> = CollectionImpl<T> & Fields<T>

export const Collection = CollectionImpl as CollectionConstructor
