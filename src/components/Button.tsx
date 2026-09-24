import styler from '@alinea/styler'
import type {MouseEvent, ReactElement, ReactNode, Ref} from 'react'
import {Button as ButtonPrimitive} from 'react-aria-components'
import css from './Button.module.css'
import {Icon} from './Icon.js'
import {Slot, type SlotProps} from './internal/Slot.js'
import {Spinner} from './Spinner.js'
import type {AriaProps, DataProps, IconType, StyleProps} from './types.js'

const styles = styler(css)

export interface ButtonProps extends StyleProps, AriaProps, DataProps {
  /** `link` looks like inline text that underlines on hover */
  variant?: 'solid' | 'outline' | 'ghost' | 'link'
  color?: 'neutral' | 'primary' | 'secondary' | 'destructive' | 'warning'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'
  /** Renders the button in its selected state, eg. an active toolbar tool */
  active?: boolean
  icon?: IconType | ReactElement
  /** Merge the button styling onto the single child element, eg. a link */
  asChild?: boolean
  type?: 'button' | 'submit' | 'reset'
  form?: string
  name?: string
  value?: string
  disabled?: boolean
  loading?: boolean
  autoFocus?: boolean
  'aria-expanded'?: boolean
  'aria-pressed'?: boolean
  'aria-controls'?: string
  'aria-current'?: boolean | 'page' | 'step' | 'location' | 'date' | 'time'
  /** Keyboard shortcuts that activate the button, eg. `Meta+K Control+K` */
  'aria-keyshortcuts'?: string
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  ref?: Ref<HTMLButtonElement>
  children?: ReactNode
}

export function Button({
  variant = 'solid',
  color = 'neutral',
  size = 'default',
  active,
  icon,
  asChild,
  disabled,
  loading,
  className,
  children,
  onClick,
  'aria-keyshortcuts': ariaKeyShortcuts,
  ...props
}: ButtonProps) {
  const attributes = {
    className: styles.Button(styler.merge({className})),
    'data-slot': props['data-slot'] ?? 'button',
    'data-variant': variant,
    'data-color': color,
    'data-size': size,
    'data-active': active || undefined
  }
  if (asChild)
    return (
      <Slot
        {...props}
        {...attributes}
        aria-keyshortcuts={ariaKeyShortcuts}
        aria-disabled={disabled || undefined}
        onClick={onClick as SlotProps['onClick']}
      >
        {children}
      </Slot>
    )
  return (
    <ButtonPrimitive
      {...props}
      {...attributes}
      isDisabled={disabled}
      isPending={loading}
      render={
        ariaKeyShortcuts
          ? // react-aria does not pass aria-keyshortcuts on to the element
            domProps => (
              <button {...domProps} aria-keyshortcuts={ariaKeyShortcuts} />
            )
          : undefined
      }
      onClick={
        onClick && (event => onClick(event as MouseEvent<HTMLButtonElement>))
      }
    >
      {loading ? (
        <Spinner aria-label="Loading" />
      ) : (
        icon && (
          <Icon
            icon={icon}
            data-slot="button-icon"
            className={styles.Button.icon()}
          />
        )
      )}
      {children}
    </ButtonPrimitive>
  )
}
