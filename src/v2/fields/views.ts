import {viewKeys} from 'alinea/dashboard/editor/ViewKeys'
import {CheckInput} from './CheckInput.js'
import type {EntryViews} from './FieldView.js'
import {PathInput} from './PathInput.js'
import {SelectInput} from './SelectInput.js'
import {TextInput} from './TextInput.js'

export const v2Views: EntryViews = {
  [viewKeys.TextInput]: TextInput,
  [viewKeys.PathInput]: PathInput,
  [viewKeys.CheckInput]: CheckInput,
  [viewKeys.SelectInput]: SelectInput
}

