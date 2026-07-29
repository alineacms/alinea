import type {Graph} from '#/core/Graph.js'
import {useAtomValue} from 'jotai'
import {graphAtom} from '../atoms/index.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useGraph(): Graph {
  return useAtomValue(graphAtom)
}
