import {entries, isRecord, keys} from './Objects.js'

// Typed values (list rows, union values, rich text blocks) are written as a
// one-key map from their type to their fields: `- Type: {fields}`

export function typedToYaml(
  type: string,
  fields: Record<string, unknown>
): Record<string, unknown> {
  return {[type]: keys(fields).length ? fields : null}
}

/** The type and fields of a typed value, also accepting an inline `_type` */
export function typedFromYaml(
  value: unknown
): [type: string, fields: Record<string, unknown>] | undefined {
  if (!isRecord(value)) return
  if (typeof value._type === 'string') {
    const {_type, ...fields} = value
    return [_type, fields]
  }
  const pairs = entries(value)
  if (pairs.length !== 1) return
  const [[type, fields]] = pairs
  if (fields === null) return [type, {}]
  if (isRecord(fields) && !('_type' in fields)) return [type, fields]
}
