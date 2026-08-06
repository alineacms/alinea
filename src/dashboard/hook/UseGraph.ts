import type {Graph} from '#/core/Graph.js'
import {useAtomValue} from 'jotai'
import {graphAtom} from '../atoms/core.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useGraph(): Graph {
  return useAtomValue(graphAtom)
}
