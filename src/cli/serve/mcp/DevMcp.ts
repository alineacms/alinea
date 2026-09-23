import type {Config} from '#/core/Config.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import {createPreview} from '#/core/media/CreatePreview.js'
import type {User} from '#/core/User.js'
import type {Request, Response} from '@alinea/iso'
import pkg from '../../../../package.json' with {type: 'json'}
import {McpGraph} from './McpGraph.js'
import {McpServer} from './McpServer.js'
import {createContentTools, mcpInstructions} from './McpTools.js'

export interface DevMcpOptions {
  config: Config
  db: LocalStore
  rootDir: string
  user: User
  /** The dev server's api handler, writes go through it like the dashboard's */
  handleApi(request: Request): Promise<Response>
}

/** The MCP endpoint of `alinea dev`, lets coding agents read and edit content */
export function createDevMcp(
  options: DevMcpOptions
): (request: Request) => Promise<Response> {
  const {config, db, rootDir, user, handleApi} = options
  return async function handleMcp(request) {
    // Files may have changed on disk since the watcher last synced (edited by
    // hand, or by another process), read what is there now
    if (request.method === 'POST')
      await db.sync().catch(error => {
        console.warn(
          `Alinea MCP could not sync content from disk: ${error instanceof Error ? error.message : String(error)}`
        )
      })
    const graph = new McpGraph({
      config,
      db,
      handle: handleApi,
      handlerUrl: new URL('/api', request.url).href
    })
    const server = new McpServer({
      name: 'alinea',
      title: 'Alinea CMS',
      version: pkg.version,
      instructions: mcpInstructions(rootDir),
      tools: createContentTools({config, graph, rootDir, user, createPreview})
    })
    return server.handle(request)
  }
}
