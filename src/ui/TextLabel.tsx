import {HTMLProps} from 'react'

export type TextLabelProps = {
  label: string
} & Omit<HTMLProps<HTMLSpanElement>, 'label'>

export function TextLabel({label, ...props}: TextLabelProps) {
  return <span {...props}>{label}</span>
}
