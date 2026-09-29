import styler from '@alinea/styler'
import type {ReactNode, Ref} from 'react'
import {Switch as SwitchPrimitive} from 'react-aria-components'
import css from './Switch.module.css'
import type {AriaProps, DataProps, StyleProps} from './types.js'

const styles = styler(css)

export interface SwitchProps extends StyleProps, AriaProps, DataProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  readOnly?: boolean
  name?: string
  value?: string
  autoFocus?: boolean
  ref?: Ref<HTMLLabelElement>
  /** The label */
  children?: ReactNode
}

export function Switch({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  readOnly,
  className,
  children,
  ...props
}: SwitchProps) {
  return (
    <SwitchPrimitive
      data-slot="switch"
      {...props}
      // react-aria focuses the hidden input from script, so :focus-visible
      // also matches after a pointer press; isFocusVisible follows the modality
      className={({isFocusVisible}) =>
        styles.Switch({focusVisible: isFocusVisible}, styler.merge({className}))
      }
      isSelected={checked}
      defaultSelected={defaultChecked}
      onChange={onCheckedChange}
      isDisabled={disabled}
      isReadOnly={readOnly}
    >
      <span data-slot="switch-track" className={styles.Switch.track()}>
        <span data-slot="switch-thumb" className={styles.Switch.thumb()} />
      </span>
      {children && (
        <span data-slot="switch-label" className={styles.Switch.label()}>
          {children}
        </span>
      )}
    </SwitchPrimitive>
  )
}
