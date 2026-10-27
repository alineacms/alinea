import type {SubmitResult} from '#/core/Connection.js'
import {Field} from '#/core/Field.js'
import {keys} from '#/core/util/Objects.js'
import {type FormState, formState} from './FormConditions.js'
import {
  type FormDefinition,
  type FormInputData,
  type FormSectionData,
  formDefinition,
  itemId,
  itemIndexes,
  itemName,
  settingsOf
} from './FormDefinition.js'
import type {FormField} from './FormField.js'
import {Input} from './FormInput.js'
import {type FormEntry, readingOrder} from './FormRules.js'

/**
 * The answers of a submission that passed, by key. A repeatable section
 * holds a list of items, each with the answers of its inputs by key.
 */
export type FormValues = Record<string, unknown>

/**
 * Messages for visitors by the name of their input, eg. `name`, or
 * `participants.0.name` in an item of a repeatable section
 */
export type FormErrors = Record<string, string>

/** What a site's server action returns to `<Form>` after submitting */
export type FormResult = SubmitResult

export type FormValidation =
  | {ok: true; values: FormValues; definition: FormDefinition}
  | {ok: false; errors: FormErrors}

/**
 * Checks the answers sent for a form: hidden and disabled inputs are left
 * out, the others must be filled in when they are required and pass the
 * validate of their input.
 */
export function validateSubmission(
  field: FormField,
  rows: unknown,
  data: FormData
): FormValidation {
  const {inputs} = Field.options(field)
  const order = readingOrder(inputs, rows)
  const definition = formDefinition(inputs, rows, order)
  const byId = new Map(order.map(entry => [entry.row._id, entry]))
  const read = (items: Array<FormInputData>, name: (key: string) => string) => {
    const result: FormValues = {}
    for (const item of items) {
      const {row, input} = byId.get(item.id)!
      const raw = data.getAll(name(item.key))
      const value = Input.parse(input, raw, settingsOf(input, row))
      if (!isEmpty(value)) result[item.key] = value
    }
    return result
  }
  const parsed: FormValues = {}
  for (const item of definition) {
    if (item.control !== 'section') Object.assign(parsed, read([item], same))
    else if (!isRepeated(item)) Object.assign(parsed, read(item.inputs, same))
    else
      parsed[item.key] = itemIndexes(item.key, data).map(index =>
        read(item.inputs, key => itemName(item.key, index, key))
      )
  }
  const state = formState(definition, parsed)
  const check = new Checker(byId, state)
  const values: FormValues = {}
  for (const item of definition) {
    if (item.control !== 'section')
      Object.assign(values, check.inputs([item], parsed, '', same))
    else if (!isRepeated(item))
      Object.assign(values, check.inputs(item.inputs, parsed, '', same))
    else if (!state.hidden.has(item.id))
      values[item.key] = check.items(
        item,
        parsed[item.key] as Array<FormValues>
      )
  }
  if (keys(check.errors).length > 0) return {ok: false, errors: check.errors}
  return {ok: true, values, definition}
}

/** Collects the answers that pass and the errors of those that do not */
class Checker {
  errors: FormErrors = {}
  #byId: Map<string, FormEntry>
  #state: FormState

  constructor(byId: Map<string, FormEntry>, state: FormState) {
    this.#byId = byId
    this.#state = state
  }

  inputs(
    items: Array<FormInputData>,
    parsed: FormValues,
    suffix: string,
    name: (key: string) => string
  ): FormValues {
    const values: FormValues = {}
    for (const item of items) {
      const id = item.id + suffix
      if (this.#state.hidden.has(id) || this.#state.disabled.has(id)) continue
      const {row, input} = this.#byId.get(item.id)!
      const value = parsed[item.key]
      if (value === undefined) {
        if (row.required === true) this.errors[name(item.key)] = required(input)
        continue
      }
      const message = validate(input, value, settingsOf(input, row))
      if (message) this.errors[name(item.key)] = message
      else values[item.key] = value
    }
    return values
  }

  items(
    section: RepeatedSection,
    parsed: Array<FormValues>
  ): Array<FormValues> {
    const {key, repeat} = section
    if (parsed.length < repeat.min)
      this.errors[key] = `Add at least ${itemCount(repeat.min)}`
    else if (repeat.max !== undefined && parsed.length > repeat.max)
      this.errors[key] = `Add at most ${itemCount(repeat.max)}`
    return parsed.map((item, index) =>
      this.inputs(section.inputs, item, itemId('', index), input =>
        itemName(key, index, input)
      )
    )
  }
}

type RepeatedSection = FormSectionData &
  Required<Pick<FormSectionData, 'key' | 'repeat'>>

function isRepeated(section: FormSectionData): section is RepeatedSection {
  return Boolean(section.repeat && section.key)
}

function same(key: string): string {
  return key
}

function itemCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'items'}`
}

function validate(input: Input, value: unknown, settings: object) {
  try {
    return input.validate?.(value as never, settings as never)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function required(input: Input): string {
  switch (Input.kind(input)) {
    case 'choice':
    case 'choices':
      return 'Choose an option'
    case 'check':
      return 'Check this to continue'
    case 'file':
      return 'Add a file'
    default:
      return 'Fill in this field'
  }
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}
