import {Api, Content, Entry, Hub, Outcome, Schema} from '@alinea/core'
import fetch from 'isomorphic-fetch'

export class ClientContent implements Content {
  constructor(protected client: Client) {}

  get(id: string): Promise<Entry.WithParents | null> {
    return this.client.fetch(Api.nav.content.get(id))
  }

  entryWithDraft(id: string): Promise<Entry.WithDraft | null> {
    return this.client.fetch(Api.nav.content.entryWithDraft(id))
  }

  put(id: string, entry: Entry): Promise<Outcome> {
    //return this.client.fetch(Api.nav.content.get(path))
    return this.client
      .fetch(Api.nav.content.get(id), {
        method: 'PUT',
        body: JSON.stringify(entry),
        headers: {'content-type': 'application/json'}
      })
      .then(res => Outcome.fromJSON(res))
  }

  putDraft(id: string, doc: string): Promise<Outcome> {
    return this.client
      .fetch(Api.nav.content.entryWithDraft(id), {
        method: 'PUT',
        body: JSON.stringify({doc}),
        headers: {'content-type': 'application/json'}
      })
      .then(res => Outcome.fromJSON(res))
  }

  list(parent?: string): Promise<Array<Entry.WithChildrenCount>> {
    return this.client.fetch(Api.nav.content.list(parent))
  }

  publish(entries: Array<Entry>): Promise<Outcome<void>> {
    return this.client
      .fetch(Api.nav.content.publish(), {
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
    return await response.json()
  }

  content = new ClientContent(this)
}
