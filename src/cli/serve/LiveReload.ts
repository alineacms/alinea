import {createId} from '#/core/Id.js'

type Client = {
  write(value: string): void
  close(): void
}

export class LiveReload {
  clients: Array<Client> = []

  reload(type: 'refetch' | 'refresh' | 'reload') {
    const revision = createId()
    const nextClients: Array<Client> = []
    for (const client of this.clients) {
      try {
        client.write(`data: ${JSON.stringify({type, revision})}\n\n`)
        if (type === 'reload') close(client)
        else nextClients.push(client)
      } catch {
        close(client)
      }
    }
    this.clients = type === 'reload' ? [] : nextClients
  }

  register(client: Client) {
    this.clients.push(client)
  }
}

function close(client: Client) {
  try {
    client.close()
  } catch {}
}
