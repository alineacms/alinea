import {useAtomValue} from 'jotai'
import {graphAtom} from '../atoms/EntryAtoms.js'

export function useGraph() {
  return useAtomValue(graphAtom)
}
