import {Api, Content, Entry, Hub} from '@alinea/core'
import fetch from 'isomorphic-fetch'

export class ClientContent implements Content {
  constructor(protected client: Client) {}

  list(): Promise<Array<Entry>> {
    return this.client.fetch(Api.nav.content.list())
  }
}

export class Client implements Hub {
  constructor(protected url: string) {}

  async fetch(endpoint: string, init?: RequestInit) {
    const response = await fetch(this.url + endpoint, init)
    return await response.json()
  }

  content() {
    return new ClientContent(this)
  }
}
