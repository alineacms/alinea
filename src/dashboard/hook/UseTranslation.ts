import {useAtomValue} from 'jotai'
import {translationAtom} from '../atoms/TranslationAtoms.js'

export function useTranslation() {
  return useAtomValue(translationAtom)
}
