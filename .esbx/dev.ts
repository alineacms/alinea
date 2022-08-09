import {serve} from '@alinea/cli/Serve'
import dotenv from 'dotenv'
import findConfig from 'find-config'
import path from 'node:path'
import {internalPlugin} from './plugin/internal'
import {sassPlugin} from './plugin/sass'

dotenv.config({path: findConfig('.env')})

const production = process.argv.includes('--production')

process.env.NODE_ENV = production ? 'production' : 'development'

serve({
  alineaDev: true,
  production,
  cwd: path.resolve('apps/web'),
  staticDir: path.resolve('packages/cli/dist/static'),
  port: 4500,
  buildOptions: {
    minify: false,
    plugins: [sassPlugin, internalPlugin]
  }
})
