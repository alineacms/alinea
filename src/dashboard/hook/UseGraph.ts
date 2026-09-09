import type {Graph} from '#/core/Graph.js'
import {useAtomValueRaw} from 'jotai'
import {graphAtom} from '../atoms/core.js'

/**
 * @deprecated Compatibility hook for legacy dashboard extensions.
 */
export function useGraph(): Graph {
  return useAtomValueRaw(graphAtom)
}
