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

/** Undefined, null, an empty string or array, or a record of those */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true
  if (Array.isArray(value)) return value.length === 0
  if (isRecord(value)) return values(value).every(isEmptyValue)
  return false
}
