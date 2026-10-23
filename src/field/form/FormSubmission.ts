import type {SubmitResult} from '#/core/Connection.js'
import {Field} from '#/core/Field.js'
import {keys} from '#/core/util/Objects.js'
import {formState} from './FormConditions.js'
import {
  type FormDefinition,
  type FormInputData,
  formDefinition,
  settingsOf
} from './FormDefinition.js'
import type {FormField} from './FormField.js'
import {Input} from './FormInput.js'
import {readingOrder} from './FormRules.js'

/** The answers of a submission that passed, by key */
export type FormValues = Record<string, unknown>

/** Messages for visitors by the key of their input */
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
  const keyOf = new Map(
    definition
      .flatMap(
        (item): Array<FormInputData> =>
          item.control === 'section' ? item.inputs : [item]
      )
      .map(item => [item.id, item.key])
  )
  const parsed: FormValues = {}
  const entries = order.filter(entry => entry.input.control !== 'section')
  for (const {row, input} of entries) {
    const key = keyOf.get(row._id)
    if (!key) continue
    const raw = data.getAll(key)
    const value = Input.parse(input, raw, settingsOf(input, row))
    if (!isEmpty(value)) parsed[key] = value
  }
  const {hidden, disabled} = formState(definition, parsed)
  const values: FormValues = {}
  const errors: FormErrors = {}
  for (const {row, input} of entries) {
    const key = keyOf.get(row._id)
    if (!key || hidden.has(row._id) || disabled.has(row._id)) continue
    const value = parsed[key]
    if (value === undefined) {
      if (row.required === true) errors[key] = requiredMessage(input)
      continue
    }
    const message = check(input, value, settingsOf(input, row))
    if (message) errors[key] = message
    else values[key] = value
  }
  if (keys(errors).length > 0) return {ok: false, errors}
  return {ok: true, values, definition}
}

function check(input: Input, value: unknown, settings: object) {
  try {
    return input.validate?.(value as never, settings as never)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function requiredMessage(input: Input): string {
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
