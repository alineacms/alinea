import {isRecord} from '#/core/util/Objects.js'
import path from 'node:path'
import {createInterface} from 'node:readline'
import pkg from '../../package.json' with {type: 'json'}
import {generatedPaths} from './generate/GeneratedPaths.js'
import {devLockFile, readDevLock} from './serve/DevLock.js'
import {mcpInstructions} from './serve/mcp/McpInstructions.js'
import {protocolVersion} from './serve/mcp/McpServer.js'
import {findConfigFile} from './util/FindConfigFile.js'

export interface McpOptions {
  cwd?: string
  configFile?: string
}

/**
 * A stdio MCP server for coding agents. It forwards to the MCP endpoint of the
 * project's running `alinea dev`, on whichever port that ended up, so agents
 * can be configured once per project.
 */
export async function mcp(options: McpOptions = {}): Promise<void> {
  const rootDir = path.resolve(options.cwd ?? process.cwd())
  const configLocation = options.configFile
    ? path.resolve(rootDir, options.configFile)
    : findConfigFile(rootDir)
  // Stdout carries the protocol, everything else goes to stderr
  if (!configLocation) {
    console.error(`No Alinea config file found in ${rootDir}`)
    process.exit(1)
  }
  const relay = mcpRelay({
    rootDir,
    lockFile: devLockFile(generatedPaths({rootDir, configLocation}).outDir),
    send(message) {
      process.stdout.write(`${message}\n`)
    }
  })
  try {
    // Answer concurrently, a slow upload should not hold up other calls
    for await (const line of createInterface({input: process.stdin}))
      void relay.handle(line)
  } finally {
    relay.close()
  }
}

export interface McpRelayOptions {
  rootDir: string
  lockFile: string
  send(message: string): void
}

export interface McpRelay {
  handle(line: string): Promise<void>
  close(): void
}

/**
 * Answers the session itself and passes tool requests on to the dev server.
 * Without one it lists no tools, then tells the client the list changed once
 * a dev server starts.
 */
export function mcpRelay({rootDir, lockFile, send}: McpRelayOptions): McpRelay {
  let waiting: ReturnType<typeof setInterval> | undefined
  const reply = (id: unknown, result: unknown) =>
    send(JSON.stringify({jsonrpc: '2.0', id, result}))
  const fail = (id: unknown, code: number, message: string) =>
    send(JSON.stringify({jsonrpc: '2.0', id, error: {code, message}}))
  function announceOnStart() {
    waiting ??= setInterval(() => {
      if (!readDevLock(lockFile)) return
      clearInterval(waiting)
      waiting = undefined
      send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/tools/list_changed'
        })
      )
    }, 1000)
  }
  async function forward(line: string) {
    const lock = readDevLock(lockFile)
    if (!lock) return
    const response = await fetch(`${lock.url}/mcp`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: line
    }).catch(() => undefined)
    return response?.text()
  }
  return {
    async handle(line) {
      let message: unknown
      try {
        message = JSON.parse(line)
      } catch {
        return fail(null, -32700, 'Parse error')
      }
      // Notifications and responses from the client need no answer
      if (!isRecord(message) || message.id === undefined) return
      const {id, method, params} = message
      if (method === 'initialize')
        return reply(id, {
          protocolVersion: protocolVersion(
            isRecord(params) && params.protocolVersion
          ),
          capabilities: {tools: {listChanged: true}},
          serverInfo: {name: 'alinea', version: pkg.version},
          instructions: mcpInstructions(rootDir)
        })
      if (method === 'ping') return reply(id, {})
      const answer = await forward(line)
      if (answer) return send(answer)
      const offline = `The Alinea tools need the dev server, start it with \`alinea dev\` in ${rootDir}`
      if (method === 'tools/list') {
        announceOnStart()
        return reply(id, {tools: []})
      }
      if (method === 'tools/call')
        return reply(id, {content: [{type: 'text', text: offline}], isError: true})
      fail(id, -32601, offline)
    },
    close() {
      clearInterval(waiting)
    }
  }
}
