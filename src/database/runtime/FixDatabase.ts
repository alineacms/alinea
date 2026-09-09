import {Entry} from '#/core/Entry.js'
import {createRecord} from '#/core/EntryRecord.js'
import type {Graph} from '#/core/Graph.js'
import type {UpdateMutation} from '#/core/db/Mutation.js'
import {hashBlob} from '#/core/source/GitUtils.js'

/** Explicit full-content maintenance, never part of startup or ordinary reads. */
export async function fixDatabase(
  graph: Graph
): Promise<Array<UpdateMutation>> {
  const mutations: Array<UpdateMutation> = []
  for (const entry of await graph.find({status: 'all', select: Entry})) {
    const bytes = new TextEncoder().encode(
      JSON.stringify(createRecord(entry, entry.status), null, 2)
    )
    if ((await hashBlob(bytes)) === entry.fileHash) continue
    mutations.push({
      op: 'update',
      id: entry.id,
      locale: entry.locale,
      status: entry.status,
      set: entry.data
    })
  }
  return mutations
}
