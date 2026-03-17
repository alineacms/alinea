import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import {ComponentType} from 'react'
import {TabsView} from './Tabs.view.js'
import {TextFieldView} from './TextField.view.js'

export const views: Record<string, ComponentType<any>> = {
  [viewKeys.TabsView]: TabsView,
  [viewKeys.TextInput]: TextFieldView
}
