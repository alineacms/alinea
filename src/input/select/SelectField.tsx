import {FieldOptions, Label, WithoutLabel} from 'alinea/core'
import {Hint} from 'alinea/core/Hint'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** A string record with option labels */
export type SelectItems<T extends string> = Record<T, Label>

/** Optional settings to configure a select field */
export interface SelectConfig<Key> extends FieldOptions<Key> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: string
  /** Display a minimal version */
  inline?: boolean
  /** Choose a custom placeholder (eg. 'Select an option')  */
  placeholder?: Label
}

export interface SelectOptions<Key extends string> extends SelectConfig<Key> {
  items: Record<Key, string>
}

export class SelectField<Key extends string> extends ScalarField<
  Key | null,
  SelectOptions<Key>
> {}

/** Create a select field configuration */

export function select<const Items extends Record<string, string>>(
  label: string,
  items: Items,
  options: WithoutLabel<SelectConfig<Extract<keyof Items, string>>> = {}
): SelectField<Extract<keyof Items, string>> {
  const keys = Object.keys(items)
  return new SelectField({
    hint: Hint.Union(keys.map(key => Hint.Literal(key))),
    options: {
      label,
      items,
      ...options
    }
  })
}
