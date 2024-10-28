import {Expand, UnionOfValues} from 'alinea/core/util/Types'
import {Expr} from './Expr.js'
import {Field} from './Field.js'
import {Type} from './Type.js'

type QueryList<T> = Expand<
  UnionOfValues<{
    [K in keyof T]: {_type: K} & QueryRow<T[K]>
  }>
>

export type QueryRow<Definition> = {
  [K in keyof Definition as Definition[K] extends Expr<any>
    ? K
    : never]: Definition[K] extends Expr<infer T> ? T : never
}

export type InferQueryValue<T> = T extends Array<Type<infer X>>
  ? InferQueryValue<X>
  : T extends Type<infer Fields>
  ? QueryRow<Fields>
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
