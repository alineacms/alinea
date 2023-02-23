import {Expr, ExprData} from './Expr'

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
      [K in keyof Row]-?: Row[K] extends Array<any>
        ? Expr<Row[K]>
        : Row[K] extends object | undefined
        ? FieldsOf<Row[K]>
        : Expr<Row[K]>
    }
  : never

// Source: https://stackoverflow.com/a/61625831/5872160
type IsStrictlyAny<T> = (T extends never ? true : false) extends false
  ? false
  : true

export type Fields<T> = IsStrictlyAny<T> extends true
  ? any
  : T extends Record<string, any>
  ? FieldsOf<T>
  : unknown

export namespace Fields {
  export function create(from: ExprData) {
    return new Proxy(
      {},
      {
        get(_, key: string) {
          return new Expr(ExprData.Field(from, key))
        }
      }
    )
  }
}
