import {useAtomValue} from 'jotai'
import {localeAtom} from '../atoms/NavigationAtoms.js'

export const useLocale = () => useAtomValue(localeAtom)
