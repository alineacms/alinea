import {serve} from '@alinea/cli/Serve.js'
import path from 'node:path'
import {InternalPackages, InternalViews, sassPlugin} from './.esbx'

serve({
  cwd: path.resolve('packages/website'),
  staticDir: path.resolve('packages/cli/src/static'),
  port: 4500,
  buildOptions: {
    plugins: [InternalViews, InternalPackages, sassPlugin]
  }
})
