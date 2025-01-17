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

export const defaultViews = {
  'alinea/field/check/CheckField.view#CheckInput': CheckInput,
  'alinea/field/code/CodeField.view#CodeInput': CodeInput,
  'alinea/field/date/DateField.view#DateInput': DateInput,
  'alinea/field/hidden/HiddenField.view#HiddenInput': HiddenInput,
  'alinea/field/json/JsonField.view#JsonInput': JsonInput,
  'alinea/field/link/LinkField.view#SingleLinkInput': SingleLinkInput,
  'alinea/field/link/LinkField.view#MultipleLinksInput': MultipleLinksInput,
  'alinea/field/list/ListField.view#ListInput': ListInput,
  'alinea/field/metadata/MetadataField.view#MetadataInput': MetadataInput,
  'alinea/field/number/NumberField.view#NumberInput': NumberInput,
  'alinea/field/object/ObjectField.view#ObjectInput': ObjectInput,
  'alinea/field/path/PathField.view#PathInput': PathInput,
  'alinea/field/richtext/RichTextField.view#RichTextInput': RichTextInput,
  'alinea/field/select/SelectField.view#SelectInput': SelectInput,
  'alinea/field/tabs/Tabs.view#TabsView': TabsView,
  'alinea/field/text/TextField.view#TextInput': TextInput,
  'alinea/field/time/TimeField.view#TimeInput': TimeInput
}
