import {
  Api,
  Content,
  createError,
  Drafts,
  Entry,
  Hub,
  outcome,
  Outcome,
  Schema
} from '@alinea/core'
import fetch from 'isomorphic-fetch'

export class ClientDrafts implements Drafts {
  constructor(protected client: Client) {}
  async get(
    id: string,
    stateVector?: Uint8Array
  ): Promise<Outcome<Uint8Array | undefined>> {
    const res = await this.client.fetch(Api.nav.drafts.get(id, stateVector))
    return outcome(async () => {
      if (res.status === 200) return new Uint8Array(await res.arrayBuffer())
      if (res.status === 404) return undefined
      throw createError(res.status, res.statusText)
    })
  }
  async update(id: string, update: Uint8Array): Promise<void> {
    const res = await this.client.fetch(Api.nav.drafts.get(id), {
      method: 'PUT',
      headers: {'content-type': 'application/octet-stream'},
      body: update
    })
    if (res.status !== 200) throw createError(res.status, res.statusText)
  }
  async delete(id: string): Promise<void> {
    const res = await this.client.fetch(Api.nav.drafts.get(id), {
      method: 'DELETE'
    })
    if (res.status !== 200) throw createError(res.status, res.statusText)
  }
}

export class ClientContent implements Content {
  constructor(protected client: Client) {}

  get(id: string): Promise<Entry.WithParents | null> {
    return this.client.fetchJson(Api.nav.content.get(id))
  }

  put(id: string, entry: Entry): Promise<Outcome> {
    return this.client
      .fetchJson(Api.nav.content.get(id), {
        method: 'PUT',
        body: JSON.stringify(entry),
        headers: {'content-type': 'application/json'}
      })
      .then(res => Outcome.fromJSON(res))
  }
  list(parent?: string): Promise<Array<Entry.WithChildrenCount>> {
    return this.client.fetchJson(Api.nav.content.list(parent))
  }

  publish(entries: Array<Entry>): Promise<Outcome<void>> {
    return this.client
      .fetchJson(Api.nav.content.publish(), {
        method: 'POST',
        body: JSON.stringify(entries),
        headers: {'content-type': 'application/json'}
      })
      .then(res => Outcome.fromJSON(res))
  }
}

export class Client implements Hub {
  constructor(
    public schema: Schema,
    protected url: string,
    protected applyAuth: (
      request?: RequestInit
    ) => RequestInit | undefined = v => v,
    protected unauthorized: () => void = () => {}
  ) {}

  async fetch(endpoint: string, init?: RequestInit) {
    const response = await fetch(this.url + endpoint, this.applyAuth(init))
    if (response.status === 401) this.unauthorized()
    return response
  }

  async fetchJson(endpoint: string, init?: RequestInit) {
    const response = await this.fetch(endpoint, this.applyAuth(init))
    return await response.json()
  }

  content = new ClientContent(this)
  drafts = new ClientDrafts(this)
}
