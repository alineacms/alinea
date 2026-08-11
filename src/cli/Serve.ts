import {Config} from '#/core/Config.js'
import type {BuildOptions} from 'esbuild'
import path from 'node:path'
import pkg from '../../package.json' with {type: 'json'}
import {buildOptions} from './build/BuildOptions.js'
import {createDevServer, type DevServer} from './serve/DevServer.js'
import {startServer} from './serve/StartServer.js'
import {dirname} from './util/Dirname.js'
import {bold, cyan, gray, reportError} from './util/Report.js'

const __dirname = dirname(import.meta.url)

export interface ServeOptions {
  cmd: 'dev' | 'build'
  cwd?: string
  base?: string
  staticDir?: string
  configFile?: string
  port?: number
  buildOptions?: BuildOptions
  alineaDev?: boolean
  production?: boolean
  onAfterGenerate?: (env?: Record<string, string>) => void
}

export async function serve(options: ServeOptions): Promise<void> {
  const {
    cwd = process.cwd(),
    base,
    staticDir = path.join(__dirname, 'static'),
    cmd
  } = options

  const preferredPort = options.port ? Number(options.port) : 4500
  const nodeServer = startServer(preferredPort, 0, cmd === 'build')
  const dashboardUrl = nodeServer.then(
    server => `http://localhost:${server.port}`
  )

  let devServer: DevServer
  try {
    devServer = await createDevServer(cwd, {
      cmd,
      base,
      staticDir,
      configFile: options.configFile,
      alineaDev: options.alineaDev,
      production: options.production,
      buildOptions: {
        ...buildOptions,
        ...options.buildOptions,
        plugins: (buildOptions.plugins || []).concat(
          options.buildOptions?.plugins || []
        )
      },
      dashboardUrl,
      onAfterGenerate(msg, config) {
        dashboardUrl.then(url => {
          const version = gray(pkg.version)
          const header = `${cyan(bold('ɑ Alinea'))} ${version}\n`
          const showUrl = cmd === 'dev' && !options.onAfterGenerate
          const connector = gray(showUrl ? '├' : '╰')
          const details = `${connector} ${gray(msg)}\n`
          const footer = showUrl
            ? `${gray('╰')} Local CMS:    ${url}\n\n`
            : '\n'
          process.stdout.write(header + details + footer)
          options.onAfterGenerate?.({
            ALINEA_DEV_SERVER: url,
            ALINEA_ADMIN_PATH: Config.adminPath(config)
          })
        })
      }
    })
  } catch (error) {
    ;(await nodeServer).close()
    if (error instanceof Error) reportError(error)
    process.exit(1)
  }

  const {serve, close} = await nodeServer
  try {
    for await (const {request, respondWith} of serve()) {
      devServer.handle(request).then(respondWith)
    }
  } finally {
    devServer.close()
    close()
  }
}
