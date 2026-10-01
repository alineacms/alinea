import {mcpRelay} from '#/cli/Mcp.js'
import {devLockFile, readDevLock, writeDevLock} from '#/cli/serve/DevLock.js'
import {suite} from '@alinea/suite'
import fs from 'node:fs/promises'
import {createServer} from 'node:http'
import path from 'node:path'

const test = suite(import.meta)

async function setup(name: string) {
  const dir = path.join(process.cwd(), 'dist/.mcp', name)
  await fs.rm(dir, {recursive: true, force: true})
  await fs.mkdir(dir, {recursive: true})
  const sent: Array<{result?: Record<string, unknown>}> = []
  const relay = mcpRelay({
    rootDir: dir,
    lockFile: devLockFile(dir),
    send: message => sent.push(JSON.parse(message))
  })
  return {dir, sent, relay}
}

function request(id: number, method: string, params = {}) {
  return JSON.stringify({jsonrpc: '2.0', id, method, params})
}

test('dev lock is ignored once its process is gone', async () => {
  const {dir, relay} = await setup('lock')
  relay.close()
  const file = devLockFile(dir)
  writeDevLock(file, {url: 'http://localhost:4500', pid: process.pid})
  test.equal(readDevLock(file), {
    url: 'http://localhost:4500',
    pid: process.pid
  })
  await fs.writeFile(file, JSON.stringify({url: 'x', pid: 2 ** 22 + 1}))
  test.is(readDevLock(file), undefined)
})

test('answers without a dev server', async () => {
  const {sent, relay} = await setup('offline')
  await relay.handle(request(1, 'initialize', {protocolVersion: '2025-03-26'}))
  await relay.handle(request(2, 'tools/list'))
  await relay.handle(request(3, 'tools/call', {name: 'get_entry'}))
  relay.close()
  test.is(sent[0].result?.protocolVersion, '2025-03-26')
  test.equal(sent[0].result?.capabilities, {tools: {listChanged: true}})
  test.equal(sent[1].result, {tools: []})
  test.is(sent[2].result?.isError, true)
})

test('announces the tools once a dev server starts', async () => {
  const {dir, sent, relay} = await setup('later')
  await relay.handle(request(1, 'tools/list'))
  writeDevLock(devLockFile(dir), {url: 'http://localhost:1', pid: process.pid})
  await new Promise(resolve => setTimeout(resolve, 1100))
  relay.close()
  test.equal(sent[1], {
    jsonrpc: '2.0',
    method: 'notifications/tools/list_changed'
  })
})

test('forwards to the running dev server', async () => {
  const {dir, sent, relay} = await setup('online')
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', chunk => (body += chunk))
    req.on('end', () => {
      const {id} = JSON.parse(body)
      res.end(JSON.stringify({jsonrpc: '2.0', id, result: {path: req.url}}))
    })
  })
  await new Promise<void>(resolve => server.listen(0, resolve))
  const {port} = server.address() as {port: number}
  try {
    writeDevLock(devLockFile(dir), {
      url: `http://localhost:${port}`,
      pid: process.pid
    })
    await relay.handle(request(1, 'tools/list'))
    test.equal(sent, [{jsonrpc: '2.0', id: 1, result: {path: '/mcp'}}])
  } finally {
    relay.close()
    server.close()
  }
})
