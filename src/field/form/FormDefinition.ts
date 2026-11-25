import type {ListRow} from '#/core/ListRow.js'
import {type TextDoc, isEmptyDoc, textDoc} from '#/core/TextDoc.js'
import {isRecord, keys} from '#/core/util/Objects.js'
import {slugify} from '#/core/util/Slugs.js'
import type {FieldValidationError} from '#/core/Validation.js'
import {type FormChoice, choices} from './FormChoices.js'
import type {FormConditionData} from './FormConditions.js'
import type {FormControl, Input} from './FormInput.js'
import {conditionData, readingOrder} from './FormRules.js'

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
  /** Rich text shown with the item, eg. below an input */
  help?: TextDoc
  /** Shown while these rules hold, always shown without them */
  showWhen?: FormConditionData
}

export interface FormInputData<
  Type extends string = string
> extends FormItemBase<Type> {
  control: Exclude<FormControl, 'section' | 'content'>
  /** The name of the control, in the FormData and in submissions */
  key: string
  required: boolean
  width: FormWidth
  attributes: Record<string, string | number | boolean>
  choices?: Array<FormChoice>
  initialValue?: unknown
  /**
   * The other settings of the input, eg. the `text` a check shows next to its
   * box as rich text, which replaces its label when it is set
   */
  settings: Record<string, unknown>
  /** Disabled while these rules hold, never disabled without them */
  disableWhen?: FormConditionData
  /** Required while these rules hold, next to `required` */
  requireWhen?: FormConditionData
  /** Each answer can be sent once, eg. one sign-up per email address */
  unique?: true
}

export interface FormSectionData<
  Type extends string = string
> extends FormItemBase<Type> {
  control: 'section'
  inputs: Array<FormSectionItem<Type>>
  /** The name of the answers of a repeatable section, a list of items */
  key?: string
  /** Visitors can add the inputs of the section more than once */
  repeat?: FormRepeat
}

/** Content between the inputs, eg. text, visitors do not answer it */
export interface FormContentData<
  Type extends string = string
> extends FormItemBase<Type> {
  control: 'content'
  /** The fields and settings of the content input, resolved */
  data: Record<string, unknown>
}

/** What a section holds: inputs and text */
export type FormSectionItem<Type extends string = string> =
  | FormInputData<Type>
  | FormContentData<Type>

/** How often visitors fill in a repeatable section */
export interface FormRepeat {
  /** The fewest items, shown when the form opens */
  min: number
  max?: number
  /** The text of the button that adds an item */
  add?: string
}

/**
 * The FormData name of an input in an item of a repeatable section, eg.
 * `participants.0.name`. Item names without an input mark that the item is
 * there when none of its inputs are filled in.
 */
export function itemName(section: string, index: number, key?: string) {
  return key === undefined
    ? `${section}.${index}`
    : `${section}.${index}.${key}`
}

/** The key of the input a FormData name belongs to */
export function nameKey(name: string): string {
  const match = /^[^.]+\.\d+\.(.+)$/.exec(name)
  return match ? match[1] : name
}

/** The positions of the items of a repeatable section in FormData */
export function itemIndexes(section: string, data: FormData): Array<number> {
  const result = new Set<number>()
  const prefix = `${section}.`
  for (const name of data.keys()) {
    if (!name.startsWith(prefix)) continue
    const index = Number(name.slice(prefix.length).split('.')[0])
    if (Number.isInteger(index) && index >= 0) result.add(index)
  }
  return [...result].sort((a, b) => a - b)
}

/** The id of an input in an item of a repeatable section, for its state */
export function itemId(id: string, index: number): string {
  return `${id}:${index}`
}

export type FormItem<Type extends string = string> =
  | FormInputData<Type>
  | FormSectionData<Type>
  | FormContentData<Type>

/** Whether an item is an input that visitors answer */
export function isFormInput<Type extends string>(
  item: FormItem<Type>
): item is FormInputData<Type> {
  return item.control !== 'section' && item.control !== 'content'
}

/** The inputs among items, without the text between them */
export function inputsOf<Type extends string>(
  items: Array<FormItem<Type>>
): Array<FormInputData<Type>> {
  return items.filter(isFormInput)
}

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
  rows: unknown,
  order = readingOrder(inputs, rows)
): FormDefinition {
  if (!Array.isArray(rows)) return []
  const byId = new Map(order.map(entry => [entry.row._id, entry]))
  return rows.filter(isRecord).flatMap((row): Array<FormItem> => {
    const type = row._type as string
    const input = inputs[type]
    const self = byId.get(row._id as string)
    if (!input || !self) return []
    const base: FormItemBase<string> = {
      id: row._id as string,
      type,
      label: text(row.label)
    }
    // Help was plain text before it was rich text
    const help = textDoc(row.help)
    if (!isEmptyDoc(help)) base.help = help
    const showWhen = conditionData(
      row.showWhen,
      self.index,
      byId,
      inputKey,
      self.repeat
    )
    if (showWhen) base.showWhen = showWhen
    if (input.control === 'section') {
      const section: FormSectionData = {
        ...base,
        control: 'section',
        // Sections do not nest
        inputs: formDefinition(inputs, row.inputs, order).filter(inSection)
      }
      if (row.repeat !== true) return [section]
      return [{...section, key: inputKey(row), repeat: repeatOf(row)}]
    }
    if (input.control === 'content')
      return [
        {...base, control: 'content', data: filled(settingsOf(input, row))}
      ]
    const settings = settingsOf(input, row)
    const {options, initialValue, ...rest} = settings
    const data: FormInputData = {
      ...base,
      control: (input.control ?? 'input') as FormInputData['control'],
      key: inputKey(row),
      required: row.required === true,
      width: row.width === 'half' ? 'half' : 'full',
      attributes: attributes(input, settings),
      settings: filled(rest)
    }
    if ('options' in settings) data.choices = choices(options)
    const disableWhen = conditionData(
      row.disableWhen,
      self.index,
      byId,
      inputKey,
      self.repeat
    )
    if (disableWhen) data.disableWhen = disableWhen
    const requireWhen = conditionData(
      row.requireWhen,
      self.index,
      byId,
      inputKey,
      self.repeat
    )
    if (requireWhen) data.requireWhen = requireWhen
    if (row.unique === true) data.unique = true
    if (!isEmpty(initialValue)) data.initialValue = initialValue
    return [data]
  })
}

/**
 * Inputs without a key or with the key of an input above them, and options
 * with the value of another option of their input
 */
export function formErrors(
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
    const keyError = (errors: Array<FieldValidationError>) => {
      // A missing label is reported on the label
      if (!text(row.label)) return errors
      const key = inputKey(row)
      const error = (message: string) => [
        ...errors,
        {path: [...at, 'key'], labels: [...within, 'Key'], message}
      ]
      if (!key) return error('Use letters or digits in the key')
      if (seen.has(key)) return error(`Another input uses the key "${key}"`)
      seen.add(key)
      return errors
    }
    if (input.control === 'section') {
      // The answers of a repeatable section are a list under its key
      const own =
        row.repeat === true ? keyError(repeatErrors(row, at, within)) : []
      return [
        ...own,
        ...formErrors(inputs, row.inputs, [...at, 'inputs'], within, seen)
      ]
    }
    // Text has no answer, so no key
    if (input.control === 'content') return []
    return keyError(optionErrors(row.options, [...at, 'options'], within))
  })
}

function repeatErrors(
  row: Record<string, unknown>,
  path: Array<string | number>,
  labels: Array<string>
): Array<FieldValidationError> {
  const {min, max} = row
  if (typeof min !== 'number' || typeof max !== 'number' || max >= min)
    return []
  return [
    {
      path: [...path, 'max'],
      labels: [...labels, 'Most items'],
      message: 'Allow at least as many items as the fewest'
    }
  ]
}

/** The repeat settings of a repeatable section row */
function repeatOf(row: Record<string, unknown>): FormRepeat {
  const min = typeof row.min === 'number' ? Math.max(0, row.min) : 1
  const repeat: FormRepeat = {min}
  if (typeof row.max === 'number' && row.max >= Math.max(min, 1))
    repeat.max = row.max
  const add = text(row.add)
  if (add) repeat.add = add
  return repeat
}

function optionErrors(
  options: unknown,
  path: Array<string | number>,
  labels: Array<string>
): Array<FieldValidationError> {
  if (!Array.isArray(options)) return []
  const seen = new Set<string>()
  return options.flatMap((option, index) => {
    const [choice] = choices([option])
    if (!choice) return []
    if (!seen.has(choice.value)) {
      seen.add(choice.value)
      return []
    }
    return [
      {
        path: [...path, index, 'value'],
        labels: [...labels, 'Options', 'Option', 'Value'],
        message: `Another option uses the value "${choice.value}"`
      }
    ]
  })
}

/**
 * The rows with the keys of inputs and the values of options that still
 * follow their label filled in, so renaming them later keeps the data that
 * was submitted and sent to the site
 */
export function fixedKeys(
  inputs: Record<string, Input>,
  rows: unknown
): unknown {
  if (!Array.isArray(rows)) return rows
  return rows.map(row => {
    if (!isRecord(row)) return row
    const input = inputs[row._type as string]
    if (!input) return row
    if (input.control === 'section') {
      const fixed = {...row, inputs: fixedKeys(inputs, row.inputs)}
      const key = inputKey(row)
      return row.repeat === true && key && !row.key ? {...fixed, key} : fixed
    }
    if (input.control === 'content') return row
    const key = inputKey(row)
    const next = key && !row.key ? {...row, key} : row
    if (!Array.isArray(row.options)) return next
    return {
      ...next,
      options: row.options.map(option => {
        const [choice] = choices([option])
        if (!choice || !isRecord(option) || option.value) return option
        return {...option, value: choice.value}
      })
    }
  })
}

/** The values of the fields and settings an input defines */
export function settingsOf(input: Input, row: Record<string, unknown>) {
  const settings: Record<string, unknown> = {}
  const names = [...keys(input.fields ?? {}), ...keys(input.settings ?? {})]
  for (const key of names) settings[key] = row[key]
  return settings
}

// The site gets the settings that were filled in
function filled(settings: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(settings))
    if (value === false || !isEmpty(value)) result[key] = value
  return result
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

// Rich text without text, eg. the text of a check, is empty as well
function isEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return isEmptyDoc(value)
  return (
    value === undefined || value === null || value === '' || value === false
  )
}

function inSection(item: FormItem): item is FormSectionItem {
  return item.control !== 'section'
}
