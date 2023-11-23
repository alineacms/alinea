import {Type} from 'alinea/core'
import {useConfig} from 'alinea/dashboard/hook/UseConfig'
import {useEntrySummary} from 'alinea/dashboard/hook/UseEntrySummary'
import {EntrySummaryRow} from 'alinea/dashboard/view/entry/EntrySummary'
import {EntryReference} from './EntryReference.js'

export interface EntryPickerRowProps {
  reference: EntryReference
}

export function EntryPickerRow({reference}: EntryPickerRowProps) {
  const entry = useEntrySummary(reference.entry)
  if (!entry) return null
  const {schema} = useConfig()
  const type = schema[entry.type]
  const View: any = (type && Type.meta(type).summaryRow) || EntrySummaryRow
  return <View {...entry} />
}
