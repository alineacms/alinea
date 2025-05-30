import {createId} from 'alinea/core/Id'

type Client = {
  write(value: string): void
  close(): void
}

export class LiveReload {
  clients: Array<Client> = []

  reload(type: 'refetch' | 'refresh' | 'reload') {
    const revision = createId()
    for (const client of this.clients) {
      client.write(`data: ${JSON.stringify({type, revision})}\n\n`)
      if (type === 'reload') client.close()
    }
    if (type === 'reload') this.clients.length = 0
  }

  register(client: Client) {
    this.clients.push(client)
  }
}
