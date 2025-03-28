import {CheckInput} from 'alinea/field/check/CheckField.view'
import {CodeInput} from 'alinea/field/code/CodeField.view'
import {DateInput} from 'alinea/field/date/DateField.view'
import {HiddenInput} from 'alinea/field/hidden/HiddenField.view'
import {JsonInput} from 'alinea/field/json/JsonField.view'
import {
  MultipleLinksInput,
  SingleLinkInput
} from 'alinea/field/link/LinkField.view'
import {ListInput} from 'alinea/field/list/ListField.view'
import {MetadataInput} from 'alinea/field/metadata/MetadataField.view'
import {NumberInput} from 'alinea/field/number/NumberField.view'
import {ObjectInput} from 'alinea/field/object/ObjectField.view'
import {PathInput} from 'alinea/field/path/PathField.view'
import {RichTextInput} from 'alinea/field/richtext/RichTextField.view'
import {SelectInput} from 'alinea/field/select/SelectField.view'
import {TabsView} from 'alinea/field/tabs/Tabs.view'
import {TextInput} from 'alinea/field/text/TextField.view'
import {TimeInput} from 'alinea/field/time/TimeField.view'
import {viewKeys} from './ViewKeys.js'

export const defaultViews = {
  [viewKeys.CheckInput]: CheckInput,
  [viewKeys.CodeInput]: CodeInput,
  [viewKeys.DateInput]: DateInput,
  [viewKeys.HiddenInput]: HiddenInput,
  [viewKeys.JsonInput]: JsonInput,
  [viewKeys.SingleLinkInput]: SingleLinkInput,
  [viewKeys.MultipleLinksInput]: MultipleLinksInput,
  [viewKeys.ListInput]: ListInput,
  [viewKeys.MetadataInput]: MetadataInput,
  [viewKeys.NumberInput]: NumberInput,
  [viewKeys.ObjectInput]: ObjectInput,
  [viewKeys.PathInput]: PathInput,
  [viewKeys.RichTextInput]: RichTextInput,
  [viewKeys.SelectInput]: SelectInput,
  [viewKeys.TabsView]: TabsView,
  [viewKeys.TextInput]: TextInput,
  [viewKeys.TimeInput]: TimeInput
}
