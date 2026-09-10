import {sha256Hash} from '../source/Utils.js'
import {isRecord} from './Objects.js'

/** Canonical JSON only: no lossy coercion of undefined, NaN, holes or class instances. */
export function canonicalJson(value: unknown): string {
  const seen = new Set<object>()
  function encode(value: unknown, depth: number): string {
    if (depth > 64) throw new Error('JSON value is too deeply nested')
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    )
      return JSON.stringify(value)
    if (typeof value === 'number' && Number.isFinite(value))
      return JSON.stringify(value)
    if (typeof value !== 'object' || !value)
      throw new Error('Expected a JSON value')
    if (seen.has(value)) throw new Error('Cyclic JSON value')
    seen.add(value)
    try {
      if (Array.isArray(value)) {
        const items: Array<string> = []
        for (let index = 0; index < value.length; index++)
          items.push(encode(value[index], depth + 1))
        return `[${items.join(',')}]`
      }
      if (
        !isRecord(value) ||
        (Object.getPrototypeOf(value) !== Object.prototype &&
          Object.getPrototypeOf(value) !== null)
      )
        throw new Error('Expected a plain JSON object')
      return `{${Object.keys(value)
        .sort()
        .map(key => `${JSON.stringify(key)}:${encode(value[key], depth + 1)}`)
        .join(',')}}`
    } finally {
      seen.delete(value)
    }
  }
  return encode(value, 0)
}

export function hashFieldValue(value: unknown): Promise<string | null> {
  return value === undefined
    ? Promise.resolve(null)
    : sha256Hash(
        new TextEncoder().encode(`alinea.field.v1\0${canonicalJson(value)}`)
      )
}
