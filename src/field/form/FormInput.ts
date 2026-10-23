import type {StoredRow} from '#/core/Infer.js'
import type {FieldsDefinition} from '#/core/Type.js'
import type {FormKind} from './FormConditions.js'
import type {ComponentType} from 'react'

/** The HTML control that renders an input on the site */
export type FormControl =
  | 'input'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkboxes'
  | 'check'
  | 'section'

/** Attributes of the rendered control, undefined ones are left out */
export type FormAttributes = Record<
  string,
  string | number | boolean | undefined
>

/** The FormData entries of an input */
export type FormRaw = Array<FormDataEntryValue>

export interface InputConfig<
  Fields extends FieldsDefinition,
  Settings extends FieldsDefinition,
  Value
> {
  /** An icon to represent the input in the form builder */
  icon?: ComponentType
  /** How the input renders on the site, an `<input>` by default */
  control?: FormControl
  /**
   * What kind of answer the input gives, which decides how the rules of other
   * inputs can test it. Follows the control unless set: a choice for a select
   * or radio, choices for checkboxes, a check for a check and text otherwise.
   */
  kind?: FormKind
  /**
   * What the editor fills in under the input in the form builder, eg. the
   * options of a select made with `Form.options`
   */
  fields?: Fields
  /**
   * What the editor sets up for this input in its settings. A setting named
   * `initialValue` prefills the input.
   */
  settings?: Settings
  /** FormData entries to a value, defaults to the first string */
  parse?(
    raw: FormRaw,
    settings: StoredRow<Fields & Settings>
  ): Value | undefined
  /** HTML constraints of the rendered input, so browsers validate natively */
  attributes?(settings: StoredRow<Fields & Settings>): FormAttributes
  /** Checked on the server after required and conditions */
  validate?(
    value: Value,
    settings: StoredRow<Fields & Settings>
  ): string | undefined
}

export interface Input<
  Fields extends FieldsDefinition = FieldsDefinition,
  Settings extends FieldsDefinition = FieldsDefinition,
  Value = unknown
> extends InputConfig<Fields, Settings, Value> {
  label: string
}

/** Create an input that editors can add to a form */
export function input<
  Fields extends FieldsDefinition = {},
  Settings extends FieldsDefinition = {},
  Value = string
>(
  label: string,
  config: InputConfig<Fields, Settings, Value> = {}
): Input<Fields, Settings, Value> {
  return {label, ...config}
}

export namespace Input {
  export function kind(input: Input): FormKind {
    if (input.kind) return input.kind
    switch (input.control) {
      case 'select':
      case 'radio':
        return 'choice'
      case 'checkboxes':
        return 'choices'
      case 'check':
        return 'check'
      default:
        return 'text'
    }
  }

  export function parse(input: Input, raw: FormRaw, settings: object): unknown {
    if (input.parse) return input.parse(raw, settings as any)
    const [first] = raw
    const text = typeof first === 'string' ? first.trim() : ''
    return text || undefined
  }
}
