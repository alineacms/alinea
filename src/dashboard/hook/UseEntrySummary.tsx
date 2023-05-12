import {useAtomValue} from 'jotai'
import {entrySummaryAtoms} from '../atoms/EntrySummaryAtoms.js'

export function useEntrySummary(id: string) {
  return useAtomValue(entrySummaryAtoms(id))
}
