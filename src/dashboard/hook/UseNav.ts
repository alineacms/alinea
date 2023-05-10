import {useAtomValue} from 'jotai'
import {navAtom} from '../atoms/NavigationAtoms.js'

export const useNav = () => useAtomValue(navAtom)
