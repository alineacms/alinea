import {canonicalJson} from '../util/Json.js'
import type {MutationContext} from './MutationContext.js'
import type {WritableGraph} from './WritableGraph.js'

/** Carry the authoring context with loaded values, never obtain it at save time.
 * This detects a changing view, not a substitute for a database read transaction.
 */
export async function readWithMutationContext<Value>(
  graph: Pick<WritableGraph, 'mutationContext'>,
  read: () => Promise<Value>
): Promise<{value: Value; context: MutationContext | undefined}> {
  const context = structuredClone(await graph.mutationContext())
  const value = await read()
  const current = await graph.mutationContext()
  if (canonicalJson(context ?? null) !== canonicalJson(current ?? null))
    throw new Error('Source changed while loading editor; reopen the entry')
  return {value, context}
}
