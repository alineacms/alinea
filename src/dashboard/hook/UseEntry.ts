import {useAtomValue} from 'jotai'
import {entryAtoms} from '../atoms/EntryAtoms.js'

export const useEntry = (id: string) => useAtomValue(entryAtoms(id))
