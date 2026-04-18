import {viewKeys} from '#/dashboard/ViewKeys.js'
import {ComponentType} from 'react'
import {CheckFieldView} from './check/CheckField.view.js'
import {CodeFieldView} from './code/CodeField.view.js'
import {DateFieldView} from './date/DateField.view.js'
import {JsonFieldView} from './json/JsonField.view.js'
import {
  MultipleLinksFieldView,
  SingleLinkFieldView
} from './link/LinkField.view.js'
import {ListFieldView} from './list/ListField.view.js'
import {MetadataFieldView} from './metadata/MetadataField.view.js'
import {NumberFieldView} from './number/NumberField.view.js'
import {ObjectFieldView} from './object/ObjectField.view.js'
import {PathFieldView} from './path/PathField.view.js'
import {RichTextFieldView} from './richtext/RichTextField.view.js'
import {SelectFieldView} from './select/SelectField.view.js'
import {TabsView} from './tabs/Tabs.view.js'
import {TextFieldView} from './text/TextField.view.js'
import {TimeFieldView} from './time/TimeField.view.js'

export const views: Record<string, ComponentType<any>> = {
  [viewKeys.CheckInput]: CheckFieldView,
  [viewKeys.CodeInput]: CodeFieldView,
  [viewKeys.DateInput]: DateFieldView,
  [viewKeys.JsonInput]: JsonFieldView,
  [viewKeys.SingleLinkInput]: SingleLinkFieldView,
  [viewKeys.MultipleLinksInput]: MultipleLinksFieldView,
  [viewKeys.TabsView]: TabsView,
  [viewKeys.NumberInput]: NumberFieldView,
  [viewKeys.MetadataInput]: MetadataFieldView,
  [viewKeys.PathInput]: PathFieldView,
  [viewKeys.SelectInput]: SelectFieldView,
  [viewKeys.RichTextInput]: RichTextFieldView,
  [viewKeys.TextInput]: TextFieldView,
  [viewKeys.TimeInput]: TimeFieldView,
  [viewKeys.ListInput]: ListFieldView,
  [viewKeys.ObjectInput]: ObjectFieldView
}
