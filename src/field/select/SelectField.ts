import type {FieldOptions, WithoutLabel} from '#/core.js'
import {ScalarField} from '#/core/field/ScalarField.js'
import {viewKeys} from '#/dashboard/ViewKeys.js'
import type {ReactNode} from 'react'

/** A string record with option labels */
export type SelectItems<T extends string> = Record<T, string>

/** Optional settings to configure a select field */
export interface SelectConfig<Value> extends FieldOptions<Value> {
  /** Width of the field in the dashboard UI (0-1) */
  width?: number
  /** Add instructional text to a field */
  help?: ReactNode
  /** Display a minimal version */
  inline?: boolean
  /** Choose a custom placeholder (eg. 'Select an option')  */
  placeholder?: string
}

export interface SelectOptions<
  Key extends string,
  Value = Key
> extends SelectConfig<Value> {
  options: Record<Key, string>
}

export type SingleSelectValue = string | null
export type MultipleSelectValue = Array<string>
export type SelectValue = SingleSelectValue | MultipleSelectValue

export type SingleSelectOptions<Key extends string> = SelectOptions<
  Key,
  Key | null
>

export type MultipleSelectOptions<Key extends string> = SelectOptions<
  Key,
  Array<Key>
>

type SelectKey<Value extends SelectValue> =
  Value extends Array<infer Key>
    ? Extract<Key, string>
    : Extract<NonNullable<Value>, string>

export class SelectField<
  Value extends SelectValue,
  Key extends string = SelectKey<Value>
> extends ScalarField<Value, SelectOptions<Key, Value>> {}

type AddNullable<Keys, Initial> = Initial extends undefined ? Keys | null : Keys

export function select<
  const Items extends Record<string, string>,
  Initial extends keyof Items | undefined = undefined
>(
  label: string,
  options: WithoutLabel<
    {options: Items} & SelectConfig<Extract<keyof Items, string>>
  > & {initialValue?: Initial}
): SelectField<
  AddNullable<Extract<keyof Items, string>, Initial>,
  Extract<keyof Items, string>
> {
  return new SelectField<
    AddNullable<Extract<keyof Items, string>, Initial>,
    Extract<keyof Items, string>
  >({
    options: {
      label,
      overview: true,
      ...options
    },
    view: viewKeys.SelectInput
  })
}

export namespace select {
  export function multiple<const Items extends Record<string, string>>(
    label: string,
    options: WithoutLabel<
      {options: Items} & SelectConfig<Array<Extract<keyof Items, string>>>
    >
  ): SelectField<
    Array<Extract<keyof Items, string>>,
    Extract<keyof Items, string>
  > {
    return new SelectField<
      Array<Extract<keyof Items, string>>,
      Extract<keyof Items, string>
    >({
      options: {
        label,
        overview: true,
        initialValue: [],
        ...options
      },
      view: viewKeys.MultipleSelectInput
    })
  }
}
