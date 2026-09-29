import {suite} from '@alinea/suite'
import net from 'node:net'
import {startBunServer, startNodeServer} from './StartServer.js'

const test = suite(import.meta)

async function occupy(port: number): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

async function freePort(): Promise<number> {
  const server = await occupy(0)
  const address = server.address() as net.AddressInfo
  server.close()
  return address.port
}

async function occupyRange(start: number, count: number) {
  const servers: Array<net.Server> = []
  for (let i = 0; i < count; i++) servers.push(await occupy(start + i))
  return () => {
    for (const server of servers) server.close()
  }
}

for (const [name, start] of [
  ['bun', startBunServer],
  ['node', startNodeServer]
] as const) {
  test(`${name}: retries the next port`, async () => {
    const port = await freePort()
    const release = await occupyRange(port, 2)
    try {
      const server = await start(port, 0, true)
      test.is(server.port, port + 2)
      server.close()
    } finally {
      release()
    }
  })

  test(`${name}: gives up after a limited number of attempts`, async () => {
    const port = await freePort()
    const release = await occupyRange(port, 12)
    try {
      const error = await start(port, 0, true).then(
        server => {
          server.close()
          return undefined
        },
        (error: unknown) => error
      )
      test.ok(error)
    } finally {
      release()
    }
  })
}
