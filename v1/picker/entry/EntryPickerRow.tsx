import {getType} from '#/core/Internal.js'
import {resolveView} from '#/core/View.js'
import {useConfig} from '#/dashboard/hook/UseConfig.js'
import {useDashboard} from '#/dashboard/hook/UseDashboard.js'
import {useEntrySummary} from '#/dashboard/hook/UseEntrySummary.js'
import {EntrySummaryRow} from '#/dashboard/view/entry/EntrySummary.js'
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
  const typeView = type && getType(type).summaryRow
  const View: any =
    (typeView && resolveView(views, typeView)) ?? EntrySummaryRow
  return <View {...entry} />
}
