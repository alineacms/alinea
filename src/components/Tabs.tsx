import styler from '@alinea/styler'
import {
  TabList as TabListPrimitive,
  type TabListProps,
  TabPanel as TabPanelPrimitive,
  type TabPanelProps,
  Tab as TabPrimitive,
  type TabProps,
  Tabs as TabsPrimitive
} from 'react-aria-components'
import type {TabsProps as TabsPrimitiveProps} from 'react-aria-components'
import css from './Tabs.module.css'

const styles = styler(css)

export type {TabProps, TabListProps, TabPanelProps} from 'react-aria-components'

export interface TabsProps extends TabsPrimitiveProps {
  variant?: 'line' | 'subtle' | 'enclosed'
  overflow?: boolean
}

export function Tabs({variant = 'line', overflow, ...props}: TabsProps) {
  const {className, ...rest} = props
  return (
    <TabsPrimitive
      data-variant={variant}
      data-overflow={overflow}
      {...rest}
      className={renderProps =>
        styles.Tabs(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    />
  )
}

export function Tab(props: TabProps) {
  const {className, ...rest} = props
  return (
    <TabPrimitive
      {...rest}
      className={renderProps =>
        styles.Tab(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    />
  )
}

export function TabList<T extends object>(
  props: TabListProps<T> & {overflow?: boolean}
) {
  const {className, ...rest} = props
  return (
    <div
      className={styles.TabList(
        styler.merge({
          className: typeof className === 'string' ? className : undefined
        })
      )}
    >
      <TabListPrimitive<T> {...rest} className={styles.TabList.list()} />
    </div>
  )
}

export function TabPanel(props: TabPanelProps) {
  const {className, ...rest} = props
  return (
    <TabPanelPrimitive
      {...rest}
      className={renderProps =>
        styles.TabPanel(
          styler.merge({
            className:
              typeof className === 'function'
                ? className(renderProps)
                : className
          })
        )
      }
    />
  )
}
