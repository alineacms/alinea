import {useAtomValue} from 'jotai'
import {graphAtom} from '../atoms/DbAtoms.js'

export function useGraph() {
  return useAtomValue(graphAtom)
}
