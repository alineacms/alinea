import {ObjectUnion, Type, type} from 'alinea/core'
import {entries, fromEntries} from 'alinea/core/util/Objects'

/** Create tabs */
export function tabs<Types extends Array<Type>>(
  ...types: Types
): Type<ObjectUnion<Types[number]>> {
  // Todo: add a way to attach a view to this type
  return type('Tabs', fromEntries(types.flatMap(entries)))
}

/** Create a tab */
export const tab = type
