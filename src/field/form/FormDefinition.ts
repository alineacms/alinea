import type {ListRow} from '#/core/ListRow.js'
import {isRecord, keys} from '#/core/util/Objects.js'
import {slugify} from '#/core/util/Slugs.js'
import type {FieldValidationError} from '#/core/Validation.js'
import {type FormChoice, choices} from './FormChoices.js'
import type {FormControl, Input} from './FormInput.js'

export type FormWidth = 'full' | 'half'

/** A row of the form field, an input or a section */
export interface FormRow extends ListRow {
  [key: string]: unknown
}

interface FormItemBase<Type extends string> {
  /** The id of the row, which conditions point at */
  id: string
  /** The name of the input in the `inputs` of the form field */
  type: Type
  label: string
  help?: string
}

export interface FormInputData<
  Type extends string = string
> extends FormItemBase<Type> {
  control: Exclude<FormControl, 'section'>
  /** The name of the control, in the FormData and in submissions */
  key: string
  required: boolean
  width: FormWidth
  attributes: Record<string, string | number | boolean>
  choices?: Array<FormChoice>
  initialValue?: unknown
  /** The other settings of the input */
  settings: Record<string, unknown>
}

export interface FormSectionData<
  Type extends string = string
> extends FormItemBase<Type> {
  control: 'section'
  inputs: Array<FormInputData<Type>>
}

export type FormItem<Type extends string = string> =
  | FormInputData<Type>
  | FormSectionData<Type>

/** A form as the site and the server see it, serialisable */
export type FormDefinition<Type extends string = string> = Array<FormItem<Type>>

/** The key of an input, its label as a slug until the editor sets one */
export function inputKey(row: Record<string, unknown>): string {
  if (typeof row.key === 'string' && row.key) return row.key
  return typeof row.label === 'string' ? slugify(row.label) : ''
}

/** The stored rows of a form field as its definition */
export function formDefinition(
  inputs: Record<string, Input>,
  rows: unknown
): FormDefinition {
  if (!Array.isArray(rows)) return []
  return rows.filter(isRecord).flatMap((row): Array<FormItem> => {
    const type = row._type as string
    const input = inputs[type]
    if (!input) return []
    const base: FormItemBase<string> = {
      id: row._id as string,
      type,
      label: text(row.label)
    }
    const help = text(row.help)
    if (help) base.help = help
    if (input.control === 'section')
      return [
        {
          ...base,
          control: 'section',
          // Sections do not nest
          inputs: formDefinition(inputs, row.inputs).filter(isInput)
        }
      ]
    const settings = settingsOf(input, row)
    const {options, initialValue, ...rest} = settings
    const data: FormInputData = {
      ...base,
      control: input.control ?? 'input',
      key: inputKey(row),
      required: row.required === true,
      width: row.width === 'half' ? 'half' : 'full',
      attributes: attributes(input, settings),
      settings: rest
    }
    if ('options' in settings) data.choices = choices(options)
    if (!isEmpty(initialValue)) data.initialValue = initialValue
    return [data]
  })
}

/** Inputs that have no key or share their key with an input above them */
export function keyErrors(
  inputs: Record<string, Input>,
  rows: unknown,
  path: Array<string | number>,
  labels: Array<string>,
  seen = new Set<string>()
): Array<FieldValidationError> {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((row, index): Array<FieldValidationError> => {
    if (!isRecord(row)) return []
    const input = inputs[row._type as string]
    if (!input) return []
    const at = [...path, index]
    const within = [...labels, input.label]
    if (input.control === 'section')
      return keyErrors(inputs, row.inputs, [...at, 'inputs'], within, seen)
    // A missing label is reported on the label
    if (!text(row.label)) return []
    const key = inputKey(row)
    const error = (message: string) => [
      {path: [...at, 'key'], labels: [...within, 'Key'], message}
    ]
    if (!key) return error('Use letters or digits in the key')
    if (seen.has(key)) return error(`Another input uses the key "${key}"`)
    seen.add(key)
    return []
  })
}

function settingsOf(input: Input, row: Record<string, unknown>) {
  const settings: Record<string, unknown> = {}
  const names = [...keys(input.fields ?? {}), ...keys(input.settings ?? {})]
  for (const key of names) settings[key] = row[key]
  return settings
}

function attributes(input: Input, settings: Record<string, unknown>) {
  const result: Record<string, string | number | boolean> = {}
  const all = input.attributes?.(settings as any) ?? {}
  for (const [name, value] of Object.entries(all))
    if (value !== undefined && value !== '' && value !== false)
      result[name] = value
  return result
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined || value === null || value === '' || value === false
  )
}

function isInput(item: FormItem): item is FormInputData {
  return item.control !== 'section'
}
