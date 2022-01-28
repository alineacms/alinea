import {Schema} from '@alinea/core'
import type {CollectionReference} from 'firebase-admin/firestore'
import * as Y from 'yjs'
import {Drafts} from '../Drafts'

type Row = {published: boolean; draft: Buffer}

export type FirestoreDraftsOptions = {
  schema: Schema
  collection: CollectionReference<Row>
}

export class FirestoreDrafts implements Drafts {
  constructor(protected options: FirestoreDraftsOptions) {}

  async get(
    id: string,
    stateVector?: Uint8Array
  ): Promise<Uint8Array | undefined> {
    const {collection} = this.options
    const ref = collection.doc(id)
    const row = await ref.get()
    if (!row.exists) return undefined
    const data = row.data()!
    if (!(data.draft instanceof Uint8Array)) return undefined
    if (!stateVector) return data.draft
    const doc = new Y.Doc()
    Y.applyUpdate(doc, data.draft)
    return Y.encodeStateAsUpdate(doc, stateVector)
  }

  async update(id: string, update: Uint8Array): Promise<void> {
    const {collection} = this.options
    const doc = new Y.Doc()
    const current = await this.get(id)
    if (current) Y.applyUpdate(doc, current)
    Y.applyUpdate(doc, update)
    const ref = collection.doc(id)
    await ref.set({
      published: false,
      draft: Buffer.from(Y.encodeStateAsUpdate(doc))
    })
  }

  async delete(ids: string[]): Promise<void> {
    const {collection} = this.options
    // Todo: this can be batched
    for (const id of ids) collection.doc(id).delete()
  }

  async *updates(): AsyncGenerator<
    {id: string; update: Uint8Array},
    any,
    unknown
  > {
    const {collection} = this.options
    const drafts = await collection.get()
    const iter: Array<{id: string; update: Uint8Array}> = []
    drafts.forEach(row => iter.push({id: row.id, update: row.data()!.draft}))
    for (const draft of iter.filter(row => Boolean(row.update))) yield draft
  }
}
