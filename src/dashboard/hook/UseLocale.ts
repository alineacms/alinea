import {atom, useAtomValue} from 'jotai'
import {currentRootAtom} from '../atoms/index.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useLocale(): string | null {
  const root = useAtomValue(currentRootAtom)
  return useAtomValue(root?.selectedLocale ?? nullLocaleAtom)
}

const nullLocaleAtom = atom<string | null>(null)
