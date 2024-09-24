import {FieldOptions, WithoutLabel} from 'alinea/core'
import {Hint} from 'alinea/core/Hint'
import {ScalarField} from 'alinea/core/field/ScalarField'

/** A string record with option labels */
export type SelectItems<T extends string> = Record<T, string>

/** Optional settings to configure a select field */
export interface SelectConfig<Key> extends FieldOptions<Key> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: string
  /** Display a minimal version */
  inline?: boolean
  /** Choose a custom placeholder (eg. 'Select an option')  */
  placeholder?: string
}

export interface SelectOptions<Key extends string> extends SelectConfig<Key> {
  options: Record<Key, string>
}

export class SelectField<Key extends string> extends ScalarField<
  Key | null,
  SelectOptions<Key>
> {}

export function select<const Items extends Record<string, string>>(
  label: string,
  items: WithoutLabel<
    {options: Items} & SelectConfig<Extract<keyof Items, string>>
  >
): SelectField<Extract<keyof Items, string>>
/** @deprecated See https://github.com/alineacms/alinea/issues/373 */
export function select<const Items extends Record<string, string>>(
  label: string,
  items: Items,
  options?: WithoutLabel<SelectConfig<Extract<keyof Items, string>>>
): SelectField<Extract<keyof Items, string>>
export function select(
  label: string,
  itemsOrOptions: any,
  options?: any
): SelectField<any> {
  const items = itemsOrOptions.options ?? itemsOrOptions
  const fieldOptions = itemsOrOptions.options ? itemsOrOptions : options
  const keys = Object.keys(items)
  return new SelectField({
    hint: Hint.Union(keys.map(key => Hint.Literal(key))),
    options: {
      label,
      options: items,
      ...fieldOptions
    },
    view: 'alinea/field/select/SelectField.view#SelectInput'
  })
}
