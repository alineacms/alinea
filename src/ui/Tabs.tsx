import styler from '@alinea/styler'
import {Tab} from '@headlessui/react'
import {ComponentPropsWithoutRef, PropsWithChildren} from 'react'
import liftCss from './Lift.module.scss'
import css from './Tabs.module.scss'

const styles = styler(css)
const liftStyles = styler(liftCss)

export namespace Tabs {
  export const Root: typeof Tab.Group = Tab.Group
  export function List({
    backdrop = true,
    ...props
  }: PropsWithChildren<
    ComponentPropsWithoutRef<typeof Tab> & {backdrop?: boolean}
  >) {
    return (
      <Tab.List
        className={
          backdrop
            ? liftStyles.header.mergeProps(props).with(styles.list)()
            : styles.list
        }
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
