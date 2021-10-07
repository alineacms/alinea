import * as RadixTabs from '@radix-ui/react-tabs'
import css from './Tabs.module.scss'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Tabs {
  export const Root = RadixTabs.Root
  export const List = styles.list.toElement(RadixTabs.List)
  export const Trigger = styles.trigger.toElement(RadixTabs.Trigger)
  export const Content = RadixTabs.Content
}
