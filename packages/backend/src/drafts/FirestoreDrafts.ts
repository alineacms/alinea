import {Hub} from '@alinea/core/Hub'
import type {CollectionReference} from 'firebase-admin/firestore'
import * as Y from 'yjs'
import {Drafts} from '../Drafts'

export type FirestoreDraftsOptions = {
  collection: CollectionReference
}

export class FirestoreDrafts implements Drafts {
  constructor(protected options: FirestoreDraftsOptions) {}

  async get({
    id,
    stateVector
  }: Hub.EntryParams): Promise<Uint8Array | undefined> {
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

  async update({id, update}: Hub.UpdateParams): Promise<Drafts.Update> {
    const {collection} = this.options
    const doc = new Y.Doc()
    const current = await this.get({id})
    if (current) Y.applyUpdate(doc, current)
    Y.applyUpdate(doc, update)
    const ref = collection.doc(id)
    const draft = Buffer.from(Y.encodeStateAsUpdate(doc))
    await ref.set({
      published: false,
      draft
    })
    return {id, update: draft}
  }

  async delete({ids}: Hub.DeleteMultipleParams): Promise<void> {
    const {collection} = this.options
    // Minor impovement: this could be batched
    for (const id of ids) await collection.doc(id).delete()
  }

  async *updates(): AsyncGenerator<Drafts.Update> {
    const {collection} = this.options
    const drafts = await collection.get()
    const iter: Array<Drafts.Update> = []
    drafts.forEach(row => iter.push({id: row.id, update: row.data()!.draft}))
    for (const draft of iter.filter(row => Boolean(row.update))) yield draft
  }
}
