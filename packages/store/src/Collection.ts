import {CursorImpl} from './Cursor'
import {Expr} from './Expr'
import {Fields} from './Fields'
import {From} from './From'
import {Selection, SelectionData, SelectionInput} from './Selection'

export type CollectionOptions = {
  flat?: boolean
  columns?: Array<string>
  where?: Expr<boolean>
  alias?: string
}

export class CollectionImpl<Row extends {} = any> extends CursorImpl<Row> {
  constructor(name: string, options: CollectionOptions = {}) {
    const {flat, columns, where, alias} = options
    const from = flat
      ? From.Table(name, columns || [], alias)
      : From.Column(From.Table(name, ['data'], alias), 'data')
    super({
      from,
      selection: SelectionData.Row(from),
      where: where?.expr
    })
  }

  pick<Props extends Array<keyof Row>>(
    ...properties: Props
  ): Selection<{
    [K in Props[number]]: Row[K]
  }> {
    const fields: Record<string, SelectionData> = {}
    for (const prop of properties)
      fields[prop as string] = SelectionData.Expr(this.get(prop as string).expr)
    return new Selection(SelectionData.Fields(fields))
  }

  get id(): Expr<string> {
    return this.get('id' as any)
  }

  with<X extends SelectionInput>(that: X): Selection.With<Row, X> {
    return this.fields.with(that)
  }

  as(name: string): Collection<Row> {
    return new Collection(From.source(this.cursor.from), {
      alias: name,
      where: this.cursor.where ? new Expr(this.cursor.where) : undefined
    })
  }
}

export interface CollectionConstructor {
  new <Row>(name: string, options?: CollectionOptions): Collection<Row>
}

export type Collection<T> = CollectionImpl<T> & Fields<T>

export const Collection = CollectionImpl as CollectionConstructor
