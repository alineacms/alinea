import {serve} from '@alinea/cli/Serve'
import path from 'node:path'
import {internalPlugin} from './plugin/internal'
import {sassPlugin} from './plugin/sass'

process.env.NODE_ENV = 'development'

serve({
  dev: true,
  cwd: path.resolve('apps/web'),
  staticDir: path.resolve('packages/cli/dist/static'),
  port: 4500,
  buildOptions: {
    plugins: [sassPlugin, internalPlugin]
  }
})
