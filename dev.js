import {serve} from 'alinea/cli/Serve'
import {forwardCommand} from 'alinea/cli/util/ForwardCommand'
import dotenv from 'dotenv'
import findConfig from 'find-config'
import path from 'node:path'

dotenv.config({path: findConfig('.env')})

const production = process.argv.includes('--production')

process.env.NODE_ENV = production ? 'production' : 'development'

serve({
  alineaDev: true,
  production,
  cwd: path.resolve('apps/web'),
  configFile: 'src/cms',
  staticDir: path.resolve('src/cli/static'),
  port: 4500,
  onAfterGenerate: forwardCommand,
  buildOptions: {
    minify: false
  }
})
