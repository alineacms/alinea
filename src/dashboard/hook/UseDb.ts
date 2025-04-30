import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import {useAtomValue} from 'jotai'
import {dbAtom} from '../atoms/DbAtoms.js'

export function useDb(): WriteableGraph {
  return useAtomValue(dbAtom)
}
