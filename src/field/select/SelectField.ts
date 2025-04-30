import type {FieldOptions, WithoutLabel} from 'alinea/core'
import {ScalarField} from 'alinea/core/field/ScalarField'
import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import type {ReactNode} from 'react'

/** A string record with option labels */
export type SelectItems<T extends string> = Record<T, string>

/** Optional settings to configure a select field */
export interface SelectConfig<Key> extends FieldOptions<Key> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
  /** Choose a custom placeholder (eg. 'Select an option')  */
  placeholder?: string
}

export interface SelectOptions<Key extends string> extends SelectConfig<Key> {
  options: Record<Key, string>
}

export class SelectField<Key extends string | null> extends ScalarField<
  Key,
  SelectOptions<NonNullable<Key>>
> {}

type AddNullable<Keys, Initial> = Initial extends undefined ? Keys | null : Keys

export function select<
  const Items extends Record<string, string>,
  Initial extends keyof Items | undefined = undefined
>(
  label: string,
  options: WithoutLabel<
    {options: Items} & SelectConfig<Extract<keyof Items, string>>
  > & {initialValue?: Initial}
): SelectField<AddNullable<Extract<keyof Items, string>, Initial>> {
  return new SelectField<AddNullable<Extract<keyof Items, string>, Initial>>({
    options: {
      label,
      ...options
    },
    view: viewKeys.SelectInput
  })
}
