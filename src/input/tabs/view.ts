import {Section, type} from 'alinea/core'
import {createTabs} from './TabsSection'
import {TabsView} from './TabsView'
export * from './TabsSection'
export * from './TabsView'
export const tabs = Section.withView(createTabs, TabsView)
export const tab = type
