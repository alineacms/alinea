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
  | 'content'

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
  /**
   * How the input renders on the site, an `<input>` by default. Content is
   * text between the inputs that visitors do not answer.
   */
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
  /**
   * The fields and settings that are texts visitors read, eg. a placeholder.
   * In a form that shares its structure between languages each language has
   * its own, all others are shared. The label and help always are texts.
   */
  strings?: Array<string>
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

/** What a content input is made of: what the editor fills in, no answer */
export type ContentConfig<
  Fields extends FieldsDefinition,
  Settings extends FieldsDefinition
> = Pick<
  InputConfig<Fields, Settings, never>,
  'icon' | 'fields' | 'settings' | 'strings'
>

/**
 * Create content that editors can add between the inputs of a form, eg. an
 * image or a notice. Visitors do not answer it. Its fields are resolved like
 * those of an entry. `<Form>` renders it with the view of its type, eg.
 * `views={{image: ImageContent}}`, or shows a rich text field named `body`.
 */
export function content<
  Fields extends FieldsDefinition = {},
  Settings extends FieldsDefinition = {}
>(
  label: string,
  config: ContentConfig<Fields, Settings> = {}
): Input<Fields, Settings, never> {
  return {label, ...config, control: 'content', parse: () => undefined}
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
