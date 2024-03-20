import {Expand, UnionOfValues} from 'alinea/core/util/Types'
import {Field} from './Field.js'
import {Type} from './Type.js'
import {Cursor} from './pages/Cursor.js'
import {Expr} from './pages/Expr.js'

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

export type InferQueryValue<T> = T extends Type<infer Fields>
  ? QueryRow<Fields>
  : T extends Field<any, infer QueryValue>
  ? QueryValue
  : T extends Cursor<infer Row>
  ? Row
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
