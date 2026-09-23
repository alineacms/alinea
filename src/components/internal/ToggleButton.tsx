import styler from '@alinea/styler'
import type {ReactElement, ReactNode, Ref} from 'react'
import {ToggleButton as ToggleButtonPrimitive} from 'react-aria-components'
import {Icon} from '../Icon.js'
import type {DataProps, IconType, StyleProps} from '../types.js'
import css from './ToggleButton.module.css'

const styles = styler(css)

export interface ToggleButtonProps extends StyleProps, DataProps {
  /** The key of this button inside a react-aria ToggleButtonGroup */
  value?: string
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
  icon?: IconType | ReactElement
  disabled?: boolean
  autoFocus?: boolean
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  ref?: Ref<HTMLButtonElement>
  children?: ReactNode
}

/**
 * The styled react-aria toggle button shared by Toggle, ToggleGroupItem and
 * ToolbarToggleItem. Inside a ToggleButtonGroup it reads its state from the
 * group by `value`.
 */
export function ToggleButton({
  value,
  pressed,
  defaultPressed,
  onPressedChange,
  variant = 'default',
  size = 'default',
  icon,
  disabled,
  className,
  children,
  ...props
}: ToggleButtonProps) {
  const inGroup = value !== undefined
  return (
    <ToggleButtonPrimitive
      {...props}
      id={inGroup ? value : props.id}
      isSelected={inGroup ? undefined : pressed}
      defaultSelected={inGroup ? undefined : defaultPressed}
      onChange={inGroup ? undefined : onPressedChange}
      isDisabled={disabled}
      className={styles.ToggleButton(styler.merge({className}))}
      data-slot={props['data-slot'] ?? 'toggle'}
      data-variant={variant}
      data-size={size}
      data-icon-only={(icon && !children) || undefined}
    >
      {icon && <Icon icon={icon} className={styles.ToggleButton.icon()} />}
      {children}
    </ToggleButtonPrimitive>
  )
}
