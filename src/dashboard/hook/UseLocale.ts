import {useAtomValue} from '../AtomHooks.js'
import {atom} from 'jotai'
import {currentRootAtom} from '../atoms/config.js'

export function useLocale(): string | null {
  const root = useAtomValue(currentRootAtom)
  return useAtomValue(root?.selectedLocale ?? nullLocaleAtom)
}

const nullLocaleAtom = atom<string | null>(null)
