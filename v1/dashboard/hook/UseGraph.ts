import type {Graph} from '#/core/Graph.js'
import {useAtomValue} from 'jotai'
import {dbAtom} from '../atoms/DbAtoms.js'

export function useGraph(): Graph {
  return useAtomValue(dbAtom)
}
