import type {Field} from '#/core/Field.js'
import {isEmptyDoc} from '#/core/TextDoc.js'
import {isRecord} from '#/core/util/Objects.js'
import type {Input} from './FormInput.js'

/**
 * The fields that hold texts of a language in a form that shares its
 * structure between languages. Every other field of its rows is shared.
 */
const strings = new WeakSet<object>()

/** Marks a field as a text that each language has of its own */
export function languageText<F extends Field>(field: F): F {
  strings.add(field)
  return field
}

/** Whether a field of a shared form holds a text of each language */
export function isLanguageText(field: Field): boolean {
  return strings.has(field)
}

/** In a shared form all fields are shared but the texts of each language */
export function isSharedFormField(field: Field): boolean {
  return !isLanguageText(field)
}

/** The keys of a row that each language has of its own */
export function textKeys(input: Input): Set<string> {
  return new Set([
    'label',
    'help',
    ...(input.control === 'section' ? ['add'] : []),
    ...(input.strings ?? [])
  ])
}

type Row = Record<string, unknown>

function rowsOf(value: unknown): Array<Row> {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

/**
 * Rows with the structure of `source` and the texts of `target`, matched by
 * id. Rows `target` has no texts for are left without them, they are not
 * translated yet.
 */
export function shareRows(
  source: unknown,
  target: unknown,
  keysOf: (row: Row) => Set<string> | undefined,
  nested: (row: Row, key: string, source: unknown, target: unknown) => unknown
): unknown {
  if (!Array.isArray(source)) return source
  const theirs = new Map(rowsOf(target).map(row => [row._id, row]))
  return source.map(row => {
    if (!isRecord(row)) return row
    const texts = keysOf(row)
    if (!texts) return row
    const other = theirs.get(row._id)
    const same = other && other._type === row._type ? other : undefined
    const result: Row = {}
    for (const [key, value] of Object.entries(row)) {
      if (texts.has(key)) continue
      result[key] = nested(row, key, value, same?.[key])
    }
    if (same)
      for (const key of texts)
        if (same[key] !== undefined) result[key] = same[key]
    return result
  })
}

/** The options of a choice share their values, each language its labels */
const optionTexts = new Set(['label'])

/**
 * The rows of a shared form as they are written into another language: the
 * inputs, their order, keys, settings and rules of the language that was
 * saved, the texts of the other language
 */
export function shareForm(
  inputs: Record<string, Input>,
  source: unknown,
  target: unknown
): unknown {
  return shareRows(
    source,
    target,
    row => {
      const input = inputs[row._type as string]
      return input && textKeys(input)
    },
    (row, key, value, theirs) => {
      const input = inputs[row._type as string]
      // The inputs of a section are shared like those of the form
      if (input?.control === 'section' && key === 'inputs')
        return shareForm(inputs, value, theirs)
      if (key === 'options')
        return shareRows(
          value,
          theirs,
          option => (option._type === 'option' ? optionTexts : undefined),
          (_, __, nestedValue) => nestedValue
        )
      return value
    }
  )
}

/** The fields of a mail that each language has of its own */
export const mailTexts = new Set(['subject', 'body'])

function isBlank(value: unknown): boolean {
  if (Array.isArray(value)) return isEmptyDoc(value)
  return value === undefined || value === null || value === ''
}

/**
 * Rows with the texts they have not translated yet taken from `others`, the
 * same rows in other languages, the language to fall back to first
 */
export function fillRows(
  rows: unknown,
  others: Array<unknown>,
  keysOf: (row: Row) => Set<string> | undefined,
  nested: (
    row: Row,
    key: string,
    value: unknown,
    theirs: Array<unknown>
  ) => unknown
): unknown {
  if (!Array.isArray(rows) || others.length === 0) return rows
  const theirs = others.map(
    other => new Map(rowsOf(other).map(row => [row._id, row]))
  )
  return rows.map(row => {
    if (!isRecord(row)) return row
    const texts = keysOf(row)
    if (!texts) return row
    const same = theirs.flatMap(map => {
      const other = map.get(row._id)
      return other && other._type === row._type ? [other] : []
    })
    const result: Row = {}
    for (const [key, value] of Object.entries(row))
      result[key] = texts.has(key)
        ? value
        : nested(
            row,
            key,
            value,
            same.map(other => other[key])
          )
    for (const key of texts) {
      if (!isBlank(row[key])) continue
      const found = same.find(other => !isBlank(other[key]))
      if (found) result[key] = found[key]
    }
    return result
  })
}

/**
 * The rows of a shared form with the texts a language has not translated
 * yet taken from `others`, the rows of the other languages in the order to
 * fall back to them
 */
export function fillForm(
  inputs: Record<string, Input>,
  rows: unknown,
  others: Array<unknown>
): unknown {
  return fillRows(
    rows,
    others,
    row => {
      const input = inputs[row._type as string]
      return input && textKeys(input)
    },
    (row, key, value, theirs) => {
      const input = inputs[row._type as string]
      if (input?.control === 'section' && key === 'inputs')
        return fillForm(inputs, value, theirs)
      if (key === 'options')
        return fillRows(
          value,
          theirs,
          option => (option._type === 'option' ? optionTexts : undefined),
          (_, __, nestedValue) => nestedValue
        )
      return value
    }
  )
}

/** The mails of a shared form with an empty subject or body filled in */
export function fillMails(mails: unknown, others: Array<unknown>): unknown {
  return fillRows(
    mails,
    others,
    () => mailTexts,
    (_, __, value) => value
  )
}
