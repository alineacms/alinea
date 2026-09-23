import styler from '@alinea/styler'
import {createContext, type ReactNode, useContext} from 'react'
import {
  TabList as TabListPrimitive,
  TabPanel as TabPanelPrimitive,
  Tab as TabPrimitive,
  Tabs as TabsPrimitive
} from 'react-aria-components'
import css from './Tabs.module.css'
import type {AriaProps, DataProps, Orientation, StyleProps} from './types.js'

const styles = styler(css)

const TabsOrientationContext = createContext<Orientation>('horizontal')

export interface TabsProps extends StyleProps, DataProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: Orientation
  variant?: 'line' | 'subtle' | 'enclosed'
  disabled?: boolean
  id?: string
  children: ReactNode
}

/** A set of layered sections of content, displayed one at a time */
export function Tabs({
  value,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  variant = 'line',
  disabled,
  className,
  children,
  ...props
}: TabsProps) {
  return (
    <TabsPrimitive
      {...props}
      data-slot={props['data-slot'] ?? 'tabs'}
      data-variant={variant}
      data-orientation={orientation}
      className={styles.Tabs(styler.merge({className}))}
      selectedKey={value}
      defaultSelectedKey={defaultValue}
      onSelectionChange={onValueChange && (key => onValueChange(String(key)))}
      orientation={orientation}
      isDisabled={disabled}
    >
      <TabsOrientationContext.Provider value={orientation}>
        {children}
      </TabsOrientationContext.Provider>
    </TabsPrimitive>
  )
}

export interface TabsListProps extends StyleProps, AriaProps, DataProps {
  children: ReactNode
}

/**
 * The row of tab triggers, it scrolls horizontally when the triggers do not
 * fit.
 */
export function TabsList({
  className,
  style,
  children,
  ...props
}: TabsListProps) {
  const orientation = useContext(TabsOrientationContext)
  return (
    <div
      data-slot="tabs-list"
      className={styles.TabsList(styler.merge({className}))}
      style={style}
    >
      <TabListPrimitive
        data-slot="tabs-list-items"
        {...props}
        data-orientation={orientation}
        className={styles.TabsList.list()}
      >
        {children}
      </TabListPrimitive>
    </div>
  )
}

export interface TabsTriggerProps extends StyleProps, DataProps {
  value: string
  disabled?: boolean
  'aria-label'?: string
  children: ReactNode
}

export function TabsTrigger({
  value,
  disabled,
  className,
  ...props
}: TabsTriggerProps) {
  return (
    <TabPrimitive
      data-slot="tabs-trigger"
      {...props}
      id={value}
      isDisabled={disabled}
      className={styles.TabsTrigger(styler.merge({className}))}
    />
  )
}

export interface TabsContentProps extends StyleProps, DataProps {
  value: string
  children?: ReactNode
}

export function TabsContent({value, className, ...props}: TabsContentProps) {
  return (
    <TabPanelPrimitive
      data-slot="tabs-content"
      {...props}
      id={value}
      className={styles.TabsContent(styler.merge({className}))}
    />
  )
}
