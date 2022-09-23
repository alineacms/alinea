type Client = {
  write(value: string): void
  close(): void
}

export class LiveReload {
  clients: Array<Client> = []

  constructor() {}

  reload(type: 'refetch' | 'refresh' | 'reload') {
    for (const client of this.clients) {
      client.write(`data: ${type}\n\n`)
      if (type === 'reload') client.close()
    }
    if (type === 'reload') this.clients.length = 0
  }

  register(client: Client) {
    this.clients.push(client)
  }
}
