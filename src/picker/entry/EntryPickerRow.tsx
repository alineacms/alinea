import {Type} from 'alinea/core'
import {useDashboard} from 'alinea/dashboard/hook/UseDashboard'
import {useEntrySummary} from 'alinea/dashboard/hook/UseEntrySummary'
import {EntrySummaryRow} from 'alinea/dashboard/view/entry/EntrySummary'
import {EntryReference} from './EntryPicker.js'

export interface EntryPickerRowProps {
  reference: EntryReference
}

export function EntryPickerRow({reference}: EntryPickerRowProps) {
  const entry = useEntrySummary(reference.entry)
  const {schema} = useDashboard().config
  const type = schema[entry.type]
  const View: any = (type && Type.meta(type).summaryRow) || EntrySummaryRow
  return <View {...entry} />
}
