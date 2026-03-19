import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import {ComponentType} from 'react'
import {ListFieldView} from './ListField.view.js'
import {ObjectFieldView} from './ObjectField.view.js'
import {TabsView} from './Tabs.view.js'
import {TextFieldView} from './TextField.view.js'

export const views: Record<string, ComponentType<any>> = {
  [viewKeys.TabsView]: TabsView,
  [viewKeys.TextInput]: TextFieldView,
  [viewKeys.ListInput]: ListFieldView,
  [viewKeys.ObjectInput]: ObjectFieldView
}
