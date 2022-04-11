import type {Redis} from 'ioredis'
import * as Y from 'yjs'
import {Drafts} from '../Drafts'

export type RedisDraftsOptions = {
  prefix?: string
  client: Redis
}

const PREFIX = '@alinea/backend.drafts.redis/'

export class RedisDrafts implements Drafts {
  options: RedisDraftsOptions

  constructor(options: RedisDraftsOptions) {
    this.options = {prefix: PREFIX, ...options}
  }

  async get(
    id: string,
    stateVector?: Uint8Array
  ): Promise<Uint8Array | undefined> {
    const {prefix, client} = this.options
    const draft = await client.getBuffer(prefix + id)
    if (!(draft instanceof Uint8Array)) return undefined
    if (!stateVector) return draft
    const doc = new Y.Doc()
    Y.applyUpdate(doc, draft)
    return Y.encodeStateAsUpdate(doc, stateVector)
  }

  async update(id: string, update: Uint8Array): Promise<Drafts.Update> {
    const {prefix, client} = this.options
    const doc = new Y.Doc()
    const current = await this.get(id)
    if (current) Y.applyUpdate(doc, current)
    Y.applyUpdate(doc, update)
    const draft = Buffer.from(Y.encodeStateAsUpdate(doc))
    client.set(prefix + id, draft)
    return {id, update: draft}
  }

  async delete(ids: string[]): Promise<void> {
    const {prefix, client} = this.options
    for (const id of ids) await client.del(prefix + id)
  }

  async *updates(): AsyncGenerator<Drafts.Update> {
    const {prefix, client} = this.options
    const stream = client.scanStream({match: `${prefix}*`})
    for await (const keys of stream) {
      for (const key of keys) {
        const id = key.slice(prefix!.length)
        yield {id, update: await client.getBuffer(key)}
      }
    }
  }
}
