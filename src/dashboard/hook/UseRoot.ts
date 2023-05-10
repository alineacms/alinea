import {useAtomValue} from 'jotai'
import {rootAtom} from '../atoms/NavigationAtoms.js'

export const useRoot = () => useAtomValue(rootAtom)
