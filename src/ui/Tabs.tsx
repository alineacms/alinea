import * as rac from 'react-aria-components'
import css from './Tabs.module.scss'
import {fromModule, style} from './util/Styler.js'

const styles = fromModule(css)

export const Tabs = rac.Tabs
export const TabList = style(rac.TabList, styles.list)
export const Tab = style(rac.Tab, styles.trigger)
export const TabPanel = rac.TabPanel
