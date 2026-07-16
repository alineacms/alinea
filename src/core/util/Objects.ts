export const {
  entries,
  fromEntries,
  keys,
  values,
  assign,
  create,
  defineProperty,
  defineProperties,
  getOwnPropertyDescriptor,
  getOwnPropertyDescriptors,
  getOwnPropertyNames,
  getOwnPropertySymbols,
  getPrototypeOf,
  setPrototypeOf,
  is,
  preventExtensions,
  seal,
  freeze,
  isExtensible,
  isSealed,
  isFrozen,
  hasOwnProperty,
  propertyIsEnumerable,
  isPrototypeOf
} = Object

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
