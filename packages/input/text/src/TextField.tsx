import {Field, Label, Value} from '@alinea/core'
import type {ComponentType} from 'react'

export type TextOptions = {
  width?: number
  help?: Label
  optional?: boolean
  multiline?: boolean
  inline?: boolean
  initialValue?: string
  iconLeft?: ComponentType
  iconRight?: ComponentType
}

export interface TextField extends Field<string> {
  label: Label
  options: TextOptions
}

export function createText(label: Label, options: TextOptions = {}): TextField {
  return {
    type: Value.Scalar,
    label,
    options
  }
}
