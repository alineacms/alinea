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
  constructor(public schema: Schema, protected url: string) {}

  async fetch(endpoint: string, init?: RequestInit) {
    const response = await fetch(this.url + endpoint, init)
    return await response.json()
  }

  content = new ClientContent(this)
}
