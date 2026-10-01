import {createId} from '#/core/Id.js'

type Client = {
  write(value: string): void
  close(): void
}

export class LiveReload {
  clients: Array<Client> = []

  reload(type: 'refetch' | 'refresh' | 'reload', configFingerprint?: string) {
    const revision = createId()
    const data = JSON.stringify({type, revision, configFingerprint})
    for (const client of this.clients) {
      client.write(`data: ${data}\n\n`)
      if (type === 'reload') client.close()
    }
    if (type === 'reload') this.clients.length = 0
  }

  register(client: Client) {
    this.clients.push(client)
    return () => {
      this.clients = this.clients.filter(c => c !== client)
    }
  }
}
