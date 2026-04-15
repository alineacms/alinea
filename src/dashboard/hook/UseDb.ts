import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {useAtomValue} from 'jotai'
import {dbAtom} from '../atoms/DbAtoms.js'

export function useDb(): WriteableGraph {
  return useAtomValue(dbAtom)
}
