import {FieldOptions, Label} from 'alinea/core'
import {Hint} from 'alinea/core/Hint'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** A string record with option labels */
export type SelectItems<T extends string> = Record<T, Label>

/** Optional settings to configure a select field */
export interface SelectConfig<Key> extends FieldOptions {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: Label
  /** Field is optional */
  optional?: boolean
  /** Display a minimal version */
  inline?: boolean
  /** Choose a custom placeholder (eg. 'Select an option')  */
  placeholder?: Label
  /** A default value */
  initialValue?: Key
  /** Hide this select field */
  hidden?: boolean
  /** Make this select field read-only */
  readOnly?: boolean
}

export interface SelectOptions<Key, Items> extends SelectConfig<Key> {
  items: Items
}

export class SelectField<Key extends string, Items> extends ScalarField<
  Key | null,
  SelectOptions<Key, Items>
> {}

/** Create a select field configuration */
export function select<Key extends string, Items extends Record<Key, string>>(
  label: Label,
  items: Items,
  options: SelectConfig<Key> = {}
): SelectField<Key, Items> {
  const keys = Object.keys(items)
  return new SelectField({
    hint: Hint.Union(keys.map(key => Hint.Literal(key))),
    label,
    options: {
      items,
      ...options
    },
    initialValue: options.initialValue ?? null
  })
}
