import styler from '@alinea/styler'
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext
} from 'react'
import {ToggleButtonGroup} from 'react-aria-components'
import {ToggleButton} from './internal/ToggleButton.js'
import css from './ToggleGroup.module.css'
import type {
  AriaProps,
  DataProps,
  IconType,
  Orientation,
  StyleProps
} from './types.js'

const styles = styler(css)

interface ToggleGroupContextValue {
  variant: 'default' | 'outline'
  size: 'default' | 'sm' | 'lg'
}

const ToggleGroupContext = createContext<ToggleGroupContextValue>({
  variant: 'default',
  size: 'default'
})

interface ToggleGroupBaseProps extends StyleProps, AriaProps, DataProps {
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
  disabled?: boolean
  orientation?: Orientation
  children: ReactNode
}

export interface ToggleGroupSingleProps extends ToggleGroupBaseProps {
  type: 'single'
  /** The pressed item, an empty string when none is pressed */
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export interface ToggleGroupMultipleProps extends ToggleGroupBaseProps {
  type: 'multiple'
  value?: Array<string>
  defaultValue?: Array<string>
  onValueChange?: (value: Array<string>) => void
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps

/** A set of two-state buttons that can be toggled on or off */
export function ToggleGroup({
  type,
  value,
  defaultValue,
  onValueChange,
  variant = 'default',
  size = 'default',
  disabled,
  orientation = 'horizontal',
  className,
  children,
  ...props
}: ToggleGroupProps) {
  return (
    <ToggleButtonGroup
      {...props}
      data-slot={props['data-slot'] ?? 'toggle-group'}
      data-variant={variant}
      data-size={size}
      data-orientation={orientation}
      className={styles.ToggleGroup(styler.merge({className}))}
      selectionMode={type}
      selectedKeys={value === undefined ? undefined : toKeys(value)}
      defaultSelectedKeys={
        defaultValue === undefined ? undefined : toKeys(defaultValue)
      }
      onSelectionChange={keys => {
        const values = Array.from(keys, String)
        if (type === 'single')
          (onValueChange as ToggleGroupSingleProps['onValueChange'])?.(
            values[0] ?? ''
          )
        else
          (onValueChange as ToggleGroupMultipleProps['onValueChange'])?.(values)
      }}
      isDisabled={disabled}
      orientation={orientation}
    >
      <ToggleGroupContext.Provider value={{variant, size}}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleButtonGroup>
  )
}

function toKeys(value: string | Array<string>): Array<string> {
  if (typeof value === 'string') return value ? [value] : []
  return value
}

export interface ToggleGroupItemProps
  extends StyleProps, Omit<AriaProps, 'id'>, DataProps {
  value: string
  icon?: IconType | ReactElement
  disabled?: boolean
  children?: ReactNode
}

export function ToggleGroupItem(props: ToggleGroupItemProps) {
  const {variant, size} = useContext(ToggleGroupContext)
  return (
    <ToggleButton
      data-slot="toggle-group-item"
      variant={variant}
      size={size}
      {...props}
    />
  )
}
