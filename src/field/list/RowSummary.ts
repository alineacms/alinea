import {Type} from '#/core/Type.js'
import {TextField} from '#/field/text/TextField.js'

/** The value of the first text field that is filled in */
export function rowSummary(type: Type, value: object): string {
  const record = value as Record<string, unknown>
  for (const [key, field] of Object.entries(Type.fields(type))) {
    if (!(field instanceof TextField)) continue
    const text = record[key]
    if (typeof text === 'string' && text.trim()) return text.trim()
  }
  return ''
}
