import {serve} from '@alinea/cli/Serve.js'
import path from 'node:path'
import {internalPlugin} from './plugin/internal'
import {sassPlugin} from './plugin/sass'

serve({
  cwd: path.resolve('apps/web'),
  staticDir: path.resolve('packages/cli/dist/static'),
  port: 4500,
  buildOptions: {
    plugins: [internalPlugin, sassPlugin]
  }
})
