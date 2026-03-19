import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import {ComponentType} from 'react'
import {CheckFieldView} from './CheckField.view.js'
import {DateFieldView} from './DateField.view.js'
import {ListFieldView} from './ListField.view.js'
import {NumberFieldView} from './NumberField.view.js'
import {ObjectFieldView} from './ObjectField.view.js'
import {SelectFieldView} from './SelectField.view.js'
import {TabsView} from './Tabs.view.js'
import {TextFieldView} from './TextField.view.js'
import {TimeFieldView} from './TimeField.view.js'

export const views: Record<string, ComponentType<any>> = {
  [viewKeys.CheckInput]: CheckFieldView,
  [viewKeys.DateInput]: DateFieldView,
  [viewKeys.TabsView]: TabsView,
  [viewKeys.NumberInput]: NumberFieldView,
  [viewKeys.SelectInput]: SelectFieldView,
  [viewKeys.TextInput]: TextFieldView,
  [viewKeys.TimeInput]: TimeFieldView,
  [viewKeys.ListInput]: ListFieldView,
  [viewKeys.ObjectInput]: ObjectFieldView
}
