import styler from '@alinea/styler'
import {
  Tab as HUITab,
  TabGroup as HUITabGroup,
  TabList as HUITabList
} from '@headlessui/react'
import {ComponentPropsWithoutRef, PropsWithChildren} from 'react'
import liftCss from './Lift.module.scss'
import css from './Tabs.module.scss'

const styles = styler(css)
const liftStyles = styler(liftCss)

export const Tabs: typeof HUITab.Group = function Tabs(
  props: PropsWithChildren<ComponentPropsWithoutRef<typeof HUITabGroup>>
) {
  return (
    <HUITabGroup {...props} className={styles.tabs()}>
      {props.children}
    </HUITabGroup>
  )
}
export const TabList: typeof HUITabList = function TabList(
  props: PropsWithChildren<ComponentPropsWithoutRef<typeof HUITabList>>
) {
  return (
    <HUITabList {...props} className={styles.triggerList()}>
      {props.children}
    </HUITabList>
  )
}
export function Tab(
  props: PropsWithChildren<ComponentPropsWithoutRef<typeof HUITab>>
) {
  return (
    <HUITab
      {...props}
      className={({selected}: {selected: boolean}) =>
        styles.trigger.mergeProps(props)({selected})
      }
    />
  )
}
export const TabPanels: typeof HUITab.Panels = HUITab.Panels
export const TabPanel: typeof HUITab.Panel = HUITab.Panel
