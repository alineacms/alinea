import type {ReactElement, ReactNode, Ref} from 'react'
import {ToggleButton} from './internal/ToggleButton.js'
import type {AriaProps, DataProps, IconType, StyleProps} from './types.js'

export interface ToggleProps extends StyleProps, AriaProps, DataProps {
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
  icon?: IconType | ReactElement
  disabled?: boolean
  autoFocus?: boolean
  ref?: Ref<HTMLButtonElement>
  children?: ReactNode
}

/** A two-state button that can be either on or off */
export function Toggle(props: ToggleProps) {
  return <ToggleButton data-slot="toggle" {...props} />
}
