import {Tab} from '@headlessui/react'
import {ComponentPropsWithoutRef, PropsWithChildren} from 'react'
import css from './Tabs.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Tabs {
  export const Root: typeof Tab.Group = Tab.Group
  export const List: typeof Tab.List = styles.list.toElement(Tab.List) as any
  export function Trigger(
    props: PropsWithChildren<ComponentPropsWithoutRef<typeof Tab>>
  ) {
    return (
      <Tab
        {...props}
        className={({selected}: {selected: boolean}) =>
          styles.trigger.mergeProps(props)({selected})
        }
      />
    )
  }
  export const Panels: typeof Tab.Panels = Tab.Panels
  export const Panel: typeof Tab.Panel = Tab.Panel
}
