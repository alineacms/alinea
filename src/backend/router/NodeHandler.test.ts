import {expect, test} from 'bun:test'
import {createServer} from 'node:http'
import type {AddressInfo} from 'node:net'
import {respondTo} from './NodeHandler.js'

test('responses keep every cookie', async () => {
  const headers = new Headers({'content-type': 'text/plain'})
  headers.append('set-cookie', 'a=1')
  headers.append('set-cookie', 'b=2')
  const server = createServer((_req, res) => {
    respondTo(res, new Response('ok', {headers}))
  })
  await new Promise<void>(resolve => server.listen(0, resolve))
  try {
    const {port} = server.address() as AddressInfo
    const response = await fetch(`http://localhost:${port}`)
    expect(response.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(await response.text()).toBe('ok')
  } finally {
    server.close()
  }
})
