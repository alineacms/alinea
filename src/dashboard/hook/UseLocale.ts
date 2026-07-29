import {atom, useAtomValue} from 'jotai'
import {currentRootAtom} from '../atoms/workspace.js'

export function useLocale(): string | null {
  const root = useAtomValue(currentRootAtom)
  return useAtomValue(root?.selectedLocale ?? nullLocaleAtom)
}

const nullLocaleAtom = atom<string | null>(null)
