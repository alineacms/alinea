import {useAtomValue} from 'jotai'
import {entryLocationAtom} from '../atoms/NavigationAtoms.js'

export const useEntryLocation = () => useAtomValue(entryLocationAtom)
