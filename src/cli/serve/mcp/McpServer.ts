import {isRecord} from '#/core/util/Objects.js'
import {Response} from '@alinea/iso'

/** Protocol versions this server speaks, newest first */
export const supportedProtocolVersions = ['2025-06-18', '2025-03-26']

export interface JsonSchema {
  type?: string | Array<string>
  description?: string
  properties?: Record<string, JsonSchema>
  required?: Array<string>
  items?: JsonSchema
  enum?: Array<string>
  additionalProperties?: boolean | JsonSchema
}

export interface McpTool {
  name: string
  description: string
  inputSchema: JsonSchema
  annotations?: {readOnlyHint?: boolean; destructiveHint?: boolean}
  /** Run the tool, the result is returned to the client as JSON text */
  call(args: Record<string, unknown>): Promise<unknown>
}

export interface McpServerOptions {
  name: string
  version: string
  instructions?: string
  tools: Array<McpTool>
}

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * Only accept requests addressed to and sent from the local machine. Checking
 * Host and Origin prevents DNS rebinding attacks from web pages.
 */
export function isLocalRequest(request: Request): boolean {
  const host = request.headers.get('host')
  if (host && !localHosts.has(hostnameOf(`http://${host}`))) return false
  const origin = request.headers.get('origin')
  if (origin && !localHosts.has(hostnameOf(origin))) return false
  return true
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

type RequestId = string | number | null

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'}
  })
}

function rpcError(id: RequestId, code: number, message: string) {
  return {jsonrpc: '2.0', id, error: {code, message}}
}

/** The response to requests the server does not answer: non-local or not POST */
export function rejectRequest(request: Request): Response | undefined {
  if (!isLocalRequest(request))
    return json(rpcError(null, -32600, 'Forbidden: non-local request'), 403)
  if (request.method !== 'POST')
    return new Response('Method not allowed, POST JSON-RPC messages', {
      status: 405,
      headers: {allow: 'POST'}
    })
}

/**
 * A stateless MCP server over the Streamable HTTP transport which answers
 * every request with a single JSON response.
 */
export class McpServer {
  #options: McpServerOptions

  constructor(options: McpServerOptions) {
    this.#options = options
  }

  async handle(request: Request): Promise<Response> {
    const rejected = rejectRequest(request)
    if (rejected) return rejected
    let message: unknown
    try {
      message = JSON.parse(await request.text())
    } catch {
      return json(rpcError(null, -32700, 'Parse error'), 400)
    }
    // Batches (removed in MCP 2025-06-18) fail this check as well
    if (!isRecord(message) || message.jsonrpc !== '2.0')
      return json(rpcError(null, -32600, 'Expected a JSON-RPC 2.0 message'))
    const {id, method, params = {}} = message
    // Notifications and responses from the client need no answer
    if (id === undefined || typeof method !== 'string')
      return new Response(undefined, {status: 202})
    if (typeof id !== 'string' && typeof id !== 'number')
      return json(rpcError(null, -32600, 'Invalid request id'))
    if (!isRecord(params))
      return json(rpcError(id, -32602, 'Invalid params: expected an object'))
    try {
      const result = await this.#request(method, params)
      if (result === undefined)
        return json(rpcError(id, -32601, `Method not found: ${method}`))
      return json({jsonrpc: '2.0', id, result})
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      return json(rpcError(id, -32602, text))
    }
  }

  async #request(method: string, params: Record<string, unknown>) {
    const {name, version, instructions, tools} = this.#options
    switch (method) {
      case 'initialize': {
        const requested = String(params.protocolVersion)
        return {
          protocolVersion: supportedProtocolVersions.includes(requested)
            ? requested
            : supportedProtocolVersions[0],
          capabilities: {tools: {}},
          serverInfo: {name, version},
          instructions
        }
      }
      case 'ping':
        return {}
      case 'tools/list':
        return {tools: tools.map(({call: _call, ...tool}) => tool)}
      case 'tools/call': {
        const tool = tools.find(tool => tool.name === params.name)
        if (!tool) throw new Error(`Unknown tool: ${params.name}`)
        const args = isRecord(params.arguments) ? params.arguments : {}
        try {
          const text = JSON.stringify(await tool.call(args))
          return {content: [{type: 'text', text}]}
        } catch (error) {
          // Tool failures are results, so the agent can correct its input
          const text = error instanceof Error ? error.message : String(error)
          return {content: [{type: 'text', text}], isError: true}
        }
      }
    }
  }
}
