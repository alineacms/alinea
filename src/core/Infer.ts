import type {Expand, UnionOfValues} from '#/core/util/Types.js'
import type {EntryFields} from './EntryFields.js'
import type {Expr} from './Expr.js'
import type {Field} from './Field.js'
import type {InferProjection} from './Graph.js'
import type {ListRow} from './ListRow.js'
import type {Type} from './Type.js'
import type {UnionMutator} from './UnionRow.js'
import type {RecordField} from './field/RecordField.js'

type QueryList<T> = Expand<
  UnionOfValues<{
    [K in keyof T]: {_type: K} & Type.Infer<T[K]>
  }>
>

export type InferQueryValue<T> =
  T extends Array<Type<infer X>>
    ? InferQueryValue<X>
    : T extends Type<infer Fields>
      ? Type.Infer<Fields>
      : T extends Expr<infer QueryValue>
        ? QueryValue
        : T extends Record<string, Type>
          ? QueryList<T>
          : InferProjection<T>

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

type CreateInputValue<T> =
  T extends RecordField<infer Row, infer _Options>
    ? Partial<Row>
    : T extends Field<infer StoredValue>
      ? StoredValue
      : never

export type CreateInputRow<Definition> = {
  [K in keyof Definition as Definition[K] extends Field
    ? K
    : never]: CreateInputValue<Definition[K]>
}

/** Single link fields, which are stored as null while empty */
type EmptyableKeys<Definition> = {
  [K in keyof Definition]: Definition[K] extends Field<
    any,
    any,
    UnionMutator<any>
  >
    ? K
    : never
}[keyof Definition]

type InitialList<T> = Expand<
  UnionOfValues<{
    [K in keyof T]: {_type: K} & InitialRow<T[K]>
  }>
>

/** Initial values of a row, single links can be left empty */
export type InitialRow<Definition> = Expand<
  Omit<StoredRow<Definition>, EmptyableKeys<Definition>> & {
    [K in EmptyableKeys<Definition>]?: Definition[K] extends Field<infer T>
      ? T | null
      : never
  }
>

/** The initial value of a field of type T, eg. the rows of a list field */
export type InferInitialValue<T> =
  T extends Type<infer Fields>
    ? InitialRow<Fields>
    : T extends Record<string, Type>
      ? InitialList<T>
      : InferStoredValue<T>

export type InferStoredValue<T> =
  T extends Type<infer Fields>
    ? StoredRow<Fields>
    : T extends Field<infer StoredValue>
      ? StoredValue
      : T extends Record<string, Type>
        ? StoredList<T>
        : T extends object
          ? StoredRow<T>
          : {}

export type Infer<T> = InferQueryValue<T>

export namespace Infer {
  /** Stored content for creation and editing, before links are resolved. */
  export type Stored<T> = InferStoredValue<T>

  export type Entry<
    T extends Type,
    TypeName extends string = string
  > = InferQueryValue<T> & Omit<EntryFields, '_type'> & {_type: TypeName}
  export type ListItem<
    T extends Type,
    TypeName extends string = string
  > = InferQueryValue<T> & Omit<ListRow, '_type'> & {_type: TypeName}
}
