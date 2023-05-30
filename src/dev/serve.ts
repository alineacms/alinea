import dotenv from 'dotenv'
import findConfig from 'find-config'
import path from 'node:path'
import {serve} from '../cli/Serve.js'

dotenv.config({path: findConfig('.env')!})

const production = process.argv.includes('--production')

process.env.NODE_ENV = production ? 'production' : 'development'

serve({
  alineaDev: true,
  production,
  cwd: path.resolve('apps/web2'),
  configFile: 'src/cms',
  staticDir: path.resolve('src/cli/static'),
  port: 4500,
  buildOptions: {
    minify: false
  }
})
