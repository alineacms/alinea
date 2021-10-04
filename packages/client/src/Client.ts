import {Api, Content, Entry, Hub, Schema} from '@alinea/core'
import fetch from 'isomorphic-fetch'

export class ClientContent implements Content {
  constructor(protected client: Client) {}

  get(path: string): Promise<Entry | null> {
    return this.client.fetch(Api.nav.content.get(path))
  }

  put(path: string, entry: Entry): Promise<void> {
    return Promise.reject()
    //return this.client.fetch(Api.nav.content.get(path))
  }

  list(parent?: string): Promise<Array<Entry.WithChildrenCount>> {
    return this.client.fetch(Api.nav.content.list(parent))
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
