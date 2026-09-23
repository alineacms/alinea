import styler from '@alinea/styler'
import {createContext, type ReactNode, useContext} from 'react'
import {Separator, Toolbar as ToolbarPrimitive} from 'react-aria-components'
import {Button, type ButtonProps} from './Button.js'
import css from './Toolbar.module.css'
import {
  ToggleGroup,
  ToggleGroupItem,
  type ToggleGroupItemProps,
  type ToggleGroupProps
} from './ToggleGroup.js'
import type {AriaProps, DataProps, Orientation, StyleProps} from './types.js'

const styles = styler(css)

const ToolbarOrientationContext = createContext<Orientation>('horizontal')

export interface ToolbarProps extends StyleProps, AriaProps, DataProps {
  orientation?: Orientation
  children: ReactNode
}

/** A container for a set of controls, navigable with the arrow keys */
export function Toolbar({
  orientation = 'horizontal',
  className,
  children,
  ...props
}: ToolbarProps) {
  return (
    <ToolbarPrimitive
      {...props}
      data-slot={props['data-slot'] ?? 'toolbar'}
      data-orientation={orientation}
      orientation={orientation}
      className={styles.Toolbar(styler.merge({className}))}
    >
      <ToolbarOrientationContext.Provider value={orientation}>
        {children}
      </ToolbarOrientationContext.Provider>
    </ToolbarPrimitive>
  )
}

export interface ToolbarGroupProps extends StyleProps, AriaProps, DataProps {
  children?: ReactNode
}

/** Groups related controls within a toolbar */
export function ToolbarGroup({className, ...props}: ToolbarGroupProps) {
  return (
    <div
      role="group"
      data-slot="toolbar-group"
      {...props}
      className={styles.ToolbarGroup(styler.merge({className}))}
    />
  )
}

export interface ToolbarButtonProps extends ButtonProps {}

/** A button within a toolbar, a ghost Button by default */
export function ToolbarButton(props: ToolbarButtonProps) {
  return <Button variant="ghost" data-slot="toolbar-button" {...props} />
}

export type ToolbarToggleGroupProps = ToggleGroupProps

export function ToolbarToggleGroup(props: ToolbarToggleGroupProps) {
  return <ToggleGroup data-slot="toolbar-toggle-group" {...props} />
}

export interface ToolbarToggleItemProps extends ToggleGroupItemProps {}

export function ToolbarToggleItem(props: ToolbarToggleItemProps) {
  return <ToggleGroupItem data-slot="toolbar-toggle-item" {...props} />
}

export interface ToolbarSeparatorProps extends StyleProps {}

export function ToolbarSeparator({className, style}: ToolbarSeparatorProps) {
  const orientation = useContext(ToolbarOrientationContext)
  const separatorOrientation =
    orientation === 'horizontal' ? 'vertical' : 'horizontal'
  return (
    <Separator
      data-slot="toolbar-separator"
      data-orientation={separatorOrientation}
      orientation={separatorOrientation}
      className={styles.ToolbarSeparator(styler.merge({className}))}
      style={style}
    />
  )
}
