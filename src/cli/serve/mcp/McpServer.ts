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
  enum?: Array<string | number | boolean | null>
  additionalProperties?: boolean | JsonSchema
  oneOf?: Array<JsonSchema>
  minimum?: number
  maximum?: number
  default?: unknown
}

export interface McpToolAnnotations {
  title?: string
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export interface McpTool {
  name: string
  title?: string
  description: string
  inputSchema: JsonSchema
  annotations?: McpToolAnnotations
  /** Run the tool, the result is returned to the client as JSON text */
  call(args: Record<string, unknown>): Promise<unknown>
}

export interface McpServerOptions {
  name: string
  title?: string
  version: string
  instructions?: string
  tools: Array<McpTool>
}

/** A tool failure with a message meant for the agent calling the tool */
export class McpToolError extends Error {}

export namespace JsonRpcError {
  export const ParseError = -32700
  export const InvalidRequest = -32600
  export const MethodNotFound = -32601
  export const InvalidParams = -32602
  export const InternalError = -32603
}

type RequestId = string | number

interface JsonRpcRequest {
  id?: RequestId
  method: string
  params?: Record<string, unknown>
}

class RpcError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
    super(message)
  }
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'}
  })
}

function errorBody(id: RequestId | null, code: number, message: string) {
  return {jsonrpc: '2.0', id, error: {code, message}}
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
    if (!isLocalRequest(request))
      return json(
        errorBody(
          null,
          JsonRpcError.InvalidRequest,
          'Forbidden: non-local request'
        ),
        403
      )
    if (request.method !== 'POST')
      return new Response('Method not allowed, POST JSON-RPC messages', {
        status: 405,
        headers: {allow: 'POST'}
      })
    const protocolHeader = request.headers.get('mcp-protocol-version')
    if (protocolHeader && !supportedProtocolVersions.includes(protocolHeader))
      return json(
        errorBody(
          null,
          JsonRpcError.InvalidRequest,
          `Unsupported MCP-Protocol-Version: ${protocolHeader}, supported: ${supportedProtocolVersions.join(', ')}`
        ),
        400
      )
    let body: unknown
    try {
      body = JSON.parse(await request.text())
    } catch {
      return json(errorBody(null, JsonRpcError.ParseError, 'Parse error'), 400)
    }
    if (Array.isArray(body)) {
      if (body.length === 0)
        return json(
          errorBody(null, JsonRpcError.InvalidRequest, 'Empty batch'),
          400
        )
      const responses = []
      for (const message of body) {
        const response = await this.message(message)
        if (response) responses.push(response)
      }
      if (responses.length === 0) return new Response(undefined, {status: 202})
      return json(responses)
    }
    const response = await this.message(body)
    if (!response) return new Response(undefined, {status: 202})
    return json(response)
  }

  /** Handle a single JSON-RPC message, returns nothing for notifications */
  async message(message: unknown): Promise<object | undefined> {
    if (!isRecord(message) || message.jsonrpc !== '2.0')
      return errorBody(
        idOf(message),
        JsonRpcError.InvalidRequest,
        'Invalid request: expected a JSON-RPC 2.0 message'
      )
    // Responses from the client need no answer
    if (!('method' in message)) return undefined
    const {id, method, params} = message
    if (typeof method !== 'string')
      return errorBody(
        idOf(message),
        JsonRpcError.InvalidRequest,
        'Invalid request: method must be a string'
      )
    if (params !== undefined && !isRecord(params))
      return errorBody(
        idOf(message),
        JsonRpcError.InvalidRequest,
        'Invalid request: params must be an object'
      )
    const isNotification = id === undefined
    if (
      !isNotification &&
      typeof id !== 'string' &&
      (typeof id !== 'number' || !Number.isFinite(id))
    )
      return errorBody(
        null,
        JsonRpcError.InvalidRequest,
        'Invalid request: id must be a string or number'
      )
    if (isNotification) return undefined
    try {
      const result = await this.request({id, method, params})
      return {jsonrpc: '2.0', id, result}
    } catch (error) {
      if (error instanceof RpcError)
        return errorBody(id, error.code, error.message)
      return errorBody(
        id,
        JsonRpcError.InternalError,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  async request({method, params = {}}: JsonRpcRequest): Promise<unknown> {
    switch (method) {
      case 'initialize':
        return this.initialize(params)
      case 'ping':
        return {}
      case 'tools/list':
        return {
          tools: this.#options.tools.map(tool => ({
            name: tool.name,
            ...(tool.title ? {title: tool.title} : {}),
            description: tool.description,
            inputSchema: tool.inputSchema,
            ...(tool.annotations ? {annotations: tool.annotations} : {})
          }))
        }
      case 'tools/call':
        return this.callTool(params)
      default:
        throw new RpcError(
          JsonRpcError.MethodNotFound,
          `Method not found: ${method}`
        )
    }
  }

  initialize(params: Record<string, unknown>) {
    const requested = params.protocolVersion
    if (typeof requested !== 'string')
      throw new RpcError(
        JsonRpcError.InvalidParams,
        'Invalid params: protocolVersion must be a string'
      )
    const protocolVersion = supportedProtocolVersions.includes(requested)
      ? requested
      : supportedProtocolVersions[0]
    const {name, title, version, instructions} = this.#options
    return {
      protocolVersion,
      capabilities: {tools: {listChanged: false}},
      serverInfo: {name, ...(title ? {title} : {}), version},
      ...(instructions ? {instructions} : {})
    }
  }

  async callTool(params: Record<string, unknown>) {
    const {name, arguments: args = {}} = params
    if (typeof name !== 'string')
      throw new RpcError(
        JsonRpcError.InvalidParams,
        'Invalid params: name must be a string'
      )
    const tool = this.#options.tools.find(tool => tool.name === name)
    if (!tool)
      throw new RpcError(
        JsonRpcError.InvalidParams,
        `Unknown tool: ${name}, available: ${this.#options.tools.map(tool => tool.name).join(', ')}`
      )
    if (!isRecord(args))
      throw new RpcError(
        JsonRpcError.InvalidParams,
        'Invalid params: arguments must be an object'
      )
    try {
      // Argument problems are reported as tool errors so the agent can retry
      const problems = validateArguments(tool.inputSchema, args)
      if (problems.length > 0)
        throw new McpToolError(
          `Invalid arguments for ${name}: ${problems.join('; ')}`
        )
      const result = await tool.call(args)
      const text =
        typeof result === 'string' ? result : JSON.stringify(result ?? null)
      return {content: [{type: 'text', text}]}
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!(error instanceof McpToolError))
        console.error(`Alinea MCP tool ${name} failed`, error)
      return {content: [{type: 'text', text: message}], isError: true}
    }
  }
}

function idOf(message: unknown): RequestId | null {
  if (!isRecord(message)) return null
  const {id} = message
  return typeof id === 'string' || typeof id === 'number' ? id : null
}

/** A shallow check of tool arguments against the tool's input schema */
export function validateArguments(
  schema: JsonSchema,
  args: Record<string, unknown>
): Array<string> {
  const problems: Array<string> = []
  const properties = schema.properties ?? {}
  for (const key of schema.required ?? [])
    if (args[key] === undefined) problems.push(`"${key}" is required`)
  for (const [key, value] of Object.entries(args)) {
    const property = properties[key]
    if (!property) {
      if (schema.additionalProperties === false)
        problems.push(
          `unknown argument "${key}", expected one of: ${Object.keys(properties).join(', ')}`
        )
      continue
    }
    if (value === undefined) continue
    const problem = checkType(property, value)
    if (problem) problems.push(`"${key}" ${problem}`)
  }
  return problems
}

function checkType(schema: JsonSchema, value: unknown): string | undefined {
  if (schema.enum && !schema.enum.includes(value as string))
    return `must be one of ${schema.enum.map(v => JSON.stringify(v)).join(', ')}`
  if (!schema.type) return
  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  const matches = types.some(type => {
    switch (type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && Number.isFinite(value)
      case 'integer':
        return Number.isInteger(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'object':
        return isRecord(value)
      case 'array':
        return Array.isArray(value)
      case 'null':
        return value === null
      default:
        return true
    }
  })
  if (!matches) return `must be of type ${types.join(' or ')}`
}
