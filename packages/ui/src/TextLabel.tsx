import {Label} from '@alinea/core'

export type TextLabelProps = {
  label: Label
}

export function TextLabel({label}: TextLabelProps) {
  if (typeof label !== 'string') throw 'Todo: translated labels'
  return <span>{label}</span>
}
