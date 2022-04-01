import {Expr} from './Expr'

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

type FieldsOf<Row> = Row extends Record<string, any>
  ? {
      [K in keyof Row]-?: Expr<Row[K]> /*& Fields<Row[K]>*/
    }
  : never

export type Fields<T> = FieldsOf<UnionToIntersection<RequiredKeepUndefined<T>>>
