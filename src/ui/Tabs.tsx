import {Tab} from '@headlessui/react'
import {ComponentPropsWithoutRef, PropsWithChildren} from 'react'
import liftCss from './Lift.module.scss'
import css from './Tabs.module.scss'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)
const liftStyles = fromModule(liftCss)

export namespace Tabs {
  export const Root: typeof Tab.Group = Tab.Group
  export function List(
    props: PropsWithChildren<ComponentPropsWithoutRef<typeof Tab>>
  ) {
    return (
      <Tab.List
        className={liftStyles.header.mergeProps(props).with(styles.list)()}
        {...props}
      />
    )
  }
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
