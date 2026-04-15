import {CheckInput} from '#/field/check/CheckField.view.js'
import {CodeInput} from '#/field/code/CodeField.view.js'
import {DateInput} from '#/field/date/DateField.view.js'
import {HiddenInput} from '#/field/hidden/HiddenField.view.js'
import {JsonInput} from '#/field/json/JsonField.view.js'
import {
  MultipleLinksInput,
  SingleLinkInput
} from '#/field/link/LinkField.view.js'
import {ListInput} from '#/field/list/ListField.view.js'
import {MetadataInput} from '#/field/metadata/MetadataField.view.js'
import {NumberInput} from '#/field/number/NumberField.view.js'
import {ObjectInput} from '#/field/object/ObjectField.view.js'
import {PathInput} from '#/field/path/PathField.view.js'
import {RichTextInput} from '#/field/richtext/RichTextField.view.js'
import {SelectInput} from '#/field/select/SelectField.view.js'
import {TabsView} from '#/field/tabs/Tabs.view.js'
import {TextInput} from '#/field/text/TextField.view.js'
import {TimeInput} from '#/field/time/TimeField.view.js'
import {MediaExplorer} from '../view/MediaExplorer.js'
import {FileEntry} from '../view/media/FileEntry.js'
import {FileSummaryRow, FileSummaryThumb} from '../view/media/FileSummary.js'
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
  [viewKeys.TimeInput]: TimeInput,
  [viewKeys.MediaExplorer]: MediaExplorer,
  [viewKeys.MediaFile]: FileEntry,
  [viewKeys.FileSummaryRow]: FileSummaryRow,
  [viewKeys.FileSummaryThumb]: FileSummaryThumb
}
