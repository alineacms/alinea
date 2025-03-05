import {Expand, UnionOfValues} from 'alinea/core/util/Types'
import {EntryFields} from './EntryFields.js'
import {Expr} from './Expr.js'
import {Field} from './Field.js'
import {Type} from './Type.js'
import {ListRow} from './shape/ListShape.js'

type QueryList<T> = Expand<
  UnionOfValues<{
    [K in keyof T]: {_type: K} & Type.Infer<T[K]>
  }>
>

export type InferQueryValue<T> = T extends Array<Type<infer X>>
  ? InferQueryValue<X>
  : T extends Type<infer Fields>
  ? Type.Infer<Fields>
  : T extends Expr<infer QueryValue>
  ? QueryValue
  : T extends Record<string, Type>
  ? QueryList<T>
  : never

type StoredList<T> = Expand<
  UnionOfValues<{
    [K in keyof T]: {_type: K} & StoredRow<T[K]>
  }>
>

export type StoredRow<Definition> = {
  [K in keyof Definition as Definition[K] extends Field<any>
    ? K
    : never]: Definition[K] extends Field<infer T> ? T : never
}

export type InferStoredValue<T> = T extends Type<infer Fields>
  ? StoredRow<Fields>
  : T extends Field<infer StoredValue>
  ? StoredValue
  : T extends Record<string, Type>
  ? StoredList<T>
  : {}

export type Infer<T> = InferQueryValue<T>

export namespace Infer {
  export type Entry<
    T extends Type,
    TypeName extends string = string
  > = InferQueryValue<T> & Omit<EntryFields, '_type'> & {_type: TypeName}
  export type ListItem<
    T extends Type,
    TypeName extends string = string
  > = InferQueryValue<T> & Omit<ListRow, '_type'> & {_type: TypeName}
}
