import {Section, type} from 'alinea/core'
import {createTabs} from './TabsSection.js'
import {TabsView} from './TabsView.js'
export * from './TabsSection.js'
export * from './TabsView.js'
export const tabs = Section.withView(createTabs, TabsView)
export const tab = type
