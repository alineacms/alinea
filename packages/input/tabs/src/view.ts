import {withView} from '@alinea/core'
import {createTabs} from './TabsField'
import {TabsView} from './TabsView'
export * from './TabsField'
export * from './TabsView'
export const tabs = withView(createTabs, TabsView)
