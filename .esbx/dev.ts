import {serve} from '@alinea/cli/Serve'
import path from 'node:path'
import {internalPlugin} from './plugin/internal'
import {sassPlugin} from './plugin/sass'

const production = process.argv.includes('--production')

process.env.NODE_ENV = production ? 'production' : 'development'

serve({
  alineaDev: true,
  production,
  cwd: path.resolve('apps/web'),
  staticDir: path.resolve('packages/cli/dist/static'),
  port: 4500,
  buildOptions: {
    plugins: [sassPlugin, internalPlugin],
    // Todo: JWT is imported from @alinea/auth.passwordless which being an
    // internal package is bundled without conditional export. Fix this is
    // in internalPlugin later.
    external: ['@peculiar/webcrypto']
  }
})
