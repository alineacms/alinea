import {object, string, type} from 'cito'
import {TypeTarget} from '../Type.js'

const TT = type(
  (value): value is TypeTarget => value && typeof value === 'object'
)

export type TargetData = typeof TargetData.infer
export const TargetData = object(
  class {
    name? = string.optional
    // alias? = string.optional
    type? = TT.optional
  }
)
