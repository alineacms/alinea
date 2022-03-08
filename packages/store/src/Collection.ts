import {Cursor} from './Cursor'
import {Expr} from './Expr'
import {From} from './From'
import {Selection, SelectionData, SelectionInput} from './Selection'

export type CollectionOptions = {
  flat?: boolean
  columns?: Array<string>
  where?: Expr<boolean>
  alias?: string
}

export class CollectionImpl<Row extends {} = any> extends Cursor<Row> {
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

// Source: https://stackoverflow.com/a/49279355/5872160
type GetKeys<U> = U extends Record<infer K, any> ? K : never
type UnionToIntersection<U extends object> = {
  [K in GetKeys<U>]: U extends Record<K, infer T> ? T : never
}
// Source: https://stackoverflow.com/a/57334147/5872160
type RequiredKeepUndefined<T> = {[K in keyof T]-?: [T[K]]} extends infer U
  ? U extends Record<keyof U, [any]>
    ? {[K in keyof U]: U[K][0]}
    : never
  : never

export type FieldsOf<Row> = Row extends {}
  ? {
      [K in keyof Row]-?: Expr<Row[K]> /* & FieldsOf<Row[K]> */
    }
  : unknown

export interface CollectionConstructor {
  new <Row extends {}>(
    name: string,
    options?: CollectionOptions
  ): Collection<Row>
}

export type Collection<T> = CollectionImpl<T> &
  (T extends {} ? FieldsOf<UnionToIntersection<RequiredKeepUndefined<T>>> : T)

export const Collection = CollectionImpl as CollectionConstructor
