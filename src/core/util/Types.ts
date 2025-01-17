export type UnionToIntersection<T> = (
  T extends any ? (x: T) => any : never
) extends (x: infer R) => any
  ? R
  : never

export function unreachable(value: never): never {
  throw new Error('unreachable')
}

// Source: https://dev.to/lucianbc/union-type-merging-in-typescript-9al
type CommonKeys<T extends object> = keyof T
type AllKeys<T> = T extends any ? keyof T : never
type Subtract<A, C> = A extends C ? never : A
type NonCommonKeys<T extends object> = Subtract<AllKeys<T>, CommonKeys<T>>
type PickType<T, K extends AllKeys<T>> = T extends {[k in K]?: any}
  ? T[K]
  : undefined
type PickTypeOf<T, K extends string | number | symbol> = K extends AllKeys<T>
  ? PickType<T, K>
  : never
export type Merge<T extends object> = {
  [k in CommonKeys<T>]: PickTypeOf<T, k>
} & {
  [k in NonCommonKeys<T>]?: PickTypeOf<T, k>
}

// Source: https://stackoverflow.com/a/61625831/5872160
export type IsStrictlyAny<T> = (T extends never ? true : false) extends false
  ? false
  : true

// Source: https://www.steveruiz.me/posts/smooshed-object-union
export type ObjectUnion<T> = {
  [K in T extends unknown ? keyof T : never]: T extends {[_ in K]: infer V}
    ? V
    : never
}

export type Expand<T> = {[K in keyof T]: T[K]} & {}

export type UnionOfValues<T> = T[keyof T]
