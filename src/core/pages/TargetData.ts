import {TypeTarget} from 'alinea/core/Type'
import {object, string, type} from 'cito'

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
