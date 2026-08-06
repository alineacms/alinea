import {useAtomValue} from 'jotai'
import {useDashboardContext} from '../hooks.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useLocale(): string | null {
  const {root} = useDashboardContext()
  return useAtomValue(root.selectedLocale)
}
