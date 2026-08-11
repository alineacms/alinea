import type {Expand, UnionOfValues} from '#/core/util/Types.js'
import type {EntryFields} from './EntryFields.js'
import type {Expr} from './Expr.js'
import type {Field} from './Field.js'
import type {InferProjection} from './Graph.js'
import type {ListRow} from './ListRow.js'
import type {Type} from './Type.js'

type QueryList<T> = Expand<
  UnionOfValues<{
    [K in keyof T]: {_type: K} & Type.Infer<T[K]>
  }>
>

export type InferQueryValue<T> =
  T extends Array<Type<infer X>>
    ? InferQueryValue<X>
    : T extends Type<infer Fields, infer Settings>
      ? Type.Infer<Type<Fields, Settings>>
      : T extends Expr<infer QueryValue>
        ? QueryValue
        : T extends Record<string, Type>
          ? QueryList<T>
          : InferProjection<T>

type StoredList<T> = Expand<
  UnionOfValues<{
    [K in keyof T]: {_type: K} & StoredType<T[K]>
  }>
>

export type StoredRow<Definition> = {
  [K in keyof Definition as Definition[K] extends Field<any>
    ? K
    : never]: Definition[K] extends Field<infer T> ? T : never
}

type StoredType<T> =
  T extends Type<infer Fields, infer Settings>
    ? Expand<
        StoredRow<Fields> &
          (Settings extends Record<string, Field>
            ? {settings: StoredRow<Settings>}
            : {})
      >
    : {}

export type InferStoredValue<T> = T extends Type
  ? StoredType<T>
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
