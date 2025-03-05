import {useAtomValue} from 'jotai'
import {entrySummaryAtoms} from '../atoms/EntrySummaryAtoms.js'
import {useLocale} from './UseLocale.js'

export function useEntrySummary(id: string) {
  const locale = useLocale()
  return useAtomValue(entrySummaryAtoms({id, locale}))
}
