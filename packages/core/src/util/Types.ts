import {createError} from '../ErrorWithCode'

export type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void
  ? I
  : never

export function unreachable(value: never): never {
  throw createError('unreachable')
}
