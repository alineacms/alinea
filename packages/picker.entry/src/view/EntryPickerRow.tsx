import {useEntrySummary} from '@alinea/dashboard/hook/UseEntrySummary'
import {useWorkspace} from '@alinea/dashboard/hook/UseWorkspace'
import {EntrySummaryRow} from '@alinea/dashboard/view/entry/EntrySummary'
import {EntryReference} from '../EntryPicker'

export interface EntryPickerRowProps {
  reference: EntryReference
}

export function EntryPickerRow({reference}: EntryPickerRowProps) {
  const entry = useEntrySummary(reference.entry)
  const {schema} = useWorkspace()
  const type = schema.type(entry.type)
  const View: any = type?.options.summaryRow || EntrySummaryRow
  return <View {...entry} />
}
