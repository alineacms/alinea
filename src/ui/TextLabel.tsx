import {Label} from 'alinea/core'
import {HTMLProps} from 'react'

export type TextLabelProps = {
  label: Label
} & Omit<HTMLProps<HTMLSpanElement>, 'label'>

export function TextLabel({label, ...props}: TextLabelProps) {
  if (typeof label !== 'string') throw 'Todo: translated labels'
  return <span {...props}>{label}</span>
}
