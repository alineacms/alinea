import {Type} from 'alinea/core/Type'
import {useConfig} from 'alinea/dashboard/hook/UseConfig'
import {useDashboard} from 'alinea/dashboard/hook/UseDashboard'
import {useEntrySummary} from 'alinea/dashboard/hook/UseEntrySummary'
import {EntrySummaryRow} from 'alinea/dashboard/view/entry/EntrySummary'
import {EntryReference} from './EntryReference.js'

export interface EntryPickerRowProps {
  reference: EntryReference
}

export function EntryPickerRow({reference}: EntryPickerRowProps) {
  const {views} = useDashboard()
  const entry = useEntrySummary(reference[EntryReference.entry])
  const {schema} = useConfig()
  if (!entry) return null
  const type = schema[entry.type]
  const typeView = type && Type.meta(type).view
  const View: any = typeView ? views[typeView] : EntrySummaryRow
  return <View {...entry} />
}
