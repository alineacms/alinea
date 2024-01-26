import {Tab as HUITab} from '@headlessui/react'
import {ComponentPropsWithoutRef, PropsWithChildren} from 'react'
import css from './Tabs.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

export const Tabs: typeof HUITab.Group = HUITab.Group
export const TabList: typeof HUITab.List = styles.list.toElement(
  HUITab.List
) as any
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
