import {nodeHandler} from '#/backend/router/NodeHandler'
import {createDevServer, type DevServer} from '#/cli/serve/DevServer'
import type {Plugin, ViteDevServer} from 'vite'

function createFallbackUrl(server: ViteDevServer): string {
  const address = server.httpServer?.address()
  const protocol = server.config.server.https ? 'https' : 'http'
  if (address && typeof address !== 'string') {
    const host =
      address.address === '::' || address.address === '0.0.0.0'
        ? 'localhost'
        : address.address
    return `${protocol}://${host}:${address.port}/`
  }
  const port = server.config.server.port || 5173
  return `${protocol}://localhost:${port}/`
}

function devServerUrl(server: ViteDevServer): string {
  return (
    server.resolvedUrls?.local[0] ||
    server.resolvedUrls?.network[0] ||
    createFallbackUrl(server)
  )
}

function waitForServerUrl(server: ViteDevServer): Promise<string> {
  return new Promise(resolve => {
    function resolveUrl() {
      resolve(devServerUrl(server))
    }

    if (server.httpServer?.listening) {
      resolveUrl()
      return
    }
    server.httpServer?.once('listening', resolveUrl)
  })
}

function isAlineaRequest(request: Request): boolean {
  const url = new URL(request.url)
  return (
    url.pathname === '/admin' ||
    url.pathname.startsWith('/admin/') ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/~dev' ||
    url.pathname.startsWith('/~dev/') ||
    url.search.startsWith('?/upload')
  )
}

export function alineaPlugin(dir: string): Plugin {
  let devServer: DevServer | undefined

  return {
    name: 'alinea-plugin',
    configureServer(server) {
      const serverUrl = waitForServerUrl(server)
      const devServerPromise = createDevServer(dir, {
        cmd: 'dev',
        dashboardUrl: serverUrl
      }).then(result => {
        devServer = result
        return result
      })

      server.httpServer?.once('close', () => {
        devServer?.close()
      })

      server.middlewares.use(
        nodeHandler(async request => {
          if (!isAlineaRequest(request)) return undefined
          const localServer = await devServerPromise
          return localServer.handle(request)
        })
      )
    },
    closeBundle() {
      devServer?.close()
    }
  }
}
