import {suite} from '@alinea/suite'
import {
  isLocalRequest,
  McpServer,
  McpToolError,
  supportedProtocolVersions
} from './McpServer.js'

const test = suite(import.meta)

const server = new McpServer({
  name: 'alinea',
  version: '1.0.0',
  instructions: 'Use the tools',
  tools: [
    {
      name: 'echo',
      description: 'Echo the input',
      inputSchema: {
        type: 'object',
        properties: {text: {type: 'string'}},
        required: ['text'],
        additionalProperties: false
      },
      async call(args) {
        return {echo: args.text}
      }
    },
    {
      name: 'fails',
      description: 'Always fails',
      inputSchema: {type: 'object', properties: {}},
      async call() {
        throw new McpToolError('title: expected a string')
      }
    }
  ]
})

interface PostOptions {
  headers?: Record<string, string>
  method?: string
  url?: string
}

function post(body: unknown, options: PostOptions = {}) {
  return server.handle(
    new Request(options.url ?? 'http://localhost:4500/mcp', {
      method: options.method ?? 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...options.headers
      },
      body:
        options.method === 'GET'
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body)
    })
  )
}

async function rpc(method: string, params?: object, id: number = 1) {
  const response = await post({jsonrpc: '2.0', id, method, params})
  test.is(response.headers.get('content-type'), 'application/json')
  return response.json()
}

test('initialize negotiates the protocol version', async () => {
  const result = await rpc('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: {name: 'claude-code', version: '2.0.0'}
  })
  test.equal(result, {
    jsonrpc: '2.0',
    id: 1,
    result: {
      protocolVersion: '2025-03-26',
      capabilities: {tools: {listChanged: false}},
      serverInfo: {name: 'alinea', version: '1.0.0'},
      instructions: 'Use the tools'
    }
  })
  const newer = await rpc('initialize', {protocolVersion: '2099-01-01'})
  test.is(newer.result.protocolVersion, supportedProtocolVersions[0])
})

test('notifications are accepted without a body', async () => {
  const response = await post({
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  })
  test.is(response.status, 202)
  test.is(await response.text(), '')
})

test('ping', async () => {
  test.equal(await rpc('ping'), {jsonrpc: '2.0', id: 1, result: {}})
})

test('tools/list', async () => {
  const {result} = await rpc('tools/list')
  test.equal(
    result.tools.map((tool: {name: string}) => tool.name),
    ['echo', 'fails']
  )
  test.equal(result.tools[0].inputSchema.required, ['text'])
})

test('tools/call returns JSON text content', async () => {
  const {result} = await rpc('tools/call', {
    name: 'echo',
    arguments: {text: 'hi'}
  })
  test.equal(result, {content: [{type: 'text', text: '{"echo":"hi"}'}]})
})

test('tool failures are results with isError', async () => {
  const {result} = await rpc('tools/call', {name: 'fails', arguments: {}})
  test.equal(result, {
    content: [{type: 'text', text: 'title: expected a string'}],
    isError: true
  })
  const invalid = await rpc('tools/call', {
    name: 'echo',
    arguments: {text: 1, other: true}
  })
  test.is(invalid.result.isError, true)
  test.ok(
    invalid.result.content[0].text.includes('"text" must be of type string')
  )
  test.ok(invalid.result.content[0].text.includes('unknown argument "other"'))
})

test('json-rpc errors', async () => {
  const unknownMethod = await rpc('resources/list')
  test.is(unknownMethod.error.code, -32601)
  const unknownTool = await rpc('tools/call', {name: 'nope'})
  test.is(unknownTool.error.code, -32602)
  const badParams = await rpc('initialize', {})
  test.is(badParams.error.code, -32602)
  const parseError = await post('{nope')
  test.is(parseError.status, 400)
  test.is((await parseError.json()).error.code, -32700)
  const invalid = await (await post({id: 3, method: 'ping'})).json()
  test.equal(invalid.error.code, -32600)
  test.is(invalid.id, 3)
})

test('batches', async () => {
  const response = await post([
    {jsonrpc: '2.0', id: 1, method: 'ping'},
    {jsonrpc: '2.0', method: 'notifications/initialized'},
    {jsonrpc: '2.0', id: 2, method: 'ping'}
  ])
  const body = await response.json()
  test.equal(
    body.map((message: {id: number}) => message.id),
    [1, 2]
  )
})

test('only POST is supported', async () => {
  const get = await post(undefined, {method: 'GET'})
  test.is(get.status, 405)
  test.is(get.headers.get('allow'), 'POST')
  const remove = await post(undefined, {method: 'DELETE'})
  test.is(remove.status, 405)
})

test('rejects non-local requests', async () => {
  // Browser-like globals (happy-dom in other suites) drop forbidden headers
  // such as origin, so check the headers on a minimal request
  function request(headers: Record<string, string>) {
    return {
      headers: {get: (name: string) => headers[name] ?? null}
    } as unknown as Request
  }
  test.not.ok(isLocalRequest(request({origin: 'https://evil.example'})))
  test.not.ok(isLocalRequest(request({origin: 'null'})))
  test.not.ok(isLocalRequest(request({host: 'evil.example:4500'})))
  test.ok(
    isLocalRequest(
      request({origin: 'http://localhost:3000', host: '127.0.0.1:4500'})
    )
  )
  test.ok(isLocalRequest(request({host: '[::1]:4500'})))
  const response = await server.handle(request({host: 'evil.example:4500'}))
  test.is(response.status, 403)
})

test('rejects unsupported protocol version headers', async () => {
  const response = await post(
    {jsonrpc: '2.0', id: 1, method: 'ping'},
    {headers: {'mcp-protocol-version': '2024-01-01'}}
  )
  test.is(response.status, 400)
  const supported = await post(
    {jsonrpc: '2.0', id: 1, method: 'ping'},
    {headers: {'mcp-protocol-version': '2025-06-18'}}
  )
  test.is(supported.status, 200)
})
