import {Cursor} from './Cursor'
import {Expr, ExprData} from './Expr'
import {From} from './From'
import {Selection, SelectionData, SelectionInput} from './Selection'

type CollectionOptions = {
  flat?: boolean
  columns?: Array<string>
  where?: Expr<boolean>
  alias?: string
}

class CollectionImpl<Row extends {} = any> extends Cursor<Row> {
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
    return new Proxy(this, {
      get(target: any, key) {
        return key in target ? target[key] : target.get(key)
      }
    })
  }

  get<T>(name: string): Expr<T> {
    return new Expr(ExprData.Field(From.path(this.cursor.from).concat(name)))
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
    return this.get('id')
  }

  get fields(): Selection<Row> {
    return new Selection(this.cursor.selection)
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

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never

export type FieldsOf<Row> = Row extends object
  ? {[K in keyof Row]-?: Expr<Row[K]> & FieldsOf<Row[K]>}
  : unknown

export interface CollectionConstructor {
  new <Row extends {}>(
    name: string,
    options?: CollectionOptions
  ): Collection<Row>
}

export type Collection<T> = CollectionImpl<T> & UnionToIntersection<FieldsOf<T>>
export namespace Collection {
  export type Generic = CollectionImpl<any>
}
export const Collection = CollectionImpl as CollectionConstructor
