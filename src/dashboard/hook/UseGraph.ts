import type {Graph} from 'alinea/core/Graph.js'
import {useAtomValue} from 'jotai'
import {dbAtom} from '../atoms/DbAtoms.js'

export function useGraph(): Graph {
  return useAtomValue(dbAtom)
}
