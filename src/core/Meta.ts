export const Meta = Symbol.for('@alinea/meta')

// Workaround: https://github.com/microsoft/TypeScript/issues/37888
export type StripMeta<T> = {
  [K in keyof T as K extends typeof Meta ? never : K]: T[K]
} & {}
