import type {Graph} from '#/core/Graph.js'
import {useAtomValueRaw} from 'jotai'
import {graphAtom} from '../atoms/core.js'

/**
 * Compatibility hook for dashboard extensions written for Alinea 1.x.
 *
 * @deprecated Use `useGraph` from 'alinea/cms'.
 */
export function useGraph(): Graph {
  return useAtomValueRaw(graphAtom)
}
