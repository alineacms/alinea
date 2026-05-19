import {atom, useAtomValue} from 'jotai'
import {useDashboard} from '../store.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useLocale(): string | null {
  const dashboard = useDashboard()
  const root = useAtomValue(dashboard.currentRoot)
  return useAtomValue(root?.selectedLocale ?? nullLocaleAtom)
}

const nullLocaleAtom = atom<string | null>(null)
