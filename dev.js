import {ensureEnv} from 'alinea/cli/util/EnsureEnv'
import {forwardCommand} from 'alinea/cli/util/ForwardCommand'
import path from 'node:path'
import sade from 'sade'

async function run({production, dir, config}) {
  ensureEnv(dir)
  const forceProduction = process.env.ALINEA_CLOUD_URL
  process.env.NODE_ENV =
    forceProduction || production ? 'production' : 'development'
  const {serve} = await import('alinea/cli/Serve')
  return serve({
    alineaDev: true,
    watch: true,
    production,
    base: 'http://localhost:3000',
    cwd: path.resolve(dir),
    configFile: config,
    staticDir: path.resolve('src/cli/static'),
    port: 4500,
    onAfterGenerate: forwardCommand,
    buildOptions: {
      minify: false
    }
  })
}

sade('dev', true)
  .option('--production', `Run in production mode`)
  .option('--dir', `Development directory`, 'apps/web')
  .option('--config', `Config file`)
  .action(opts => run(opts))
  .parse(process.argv)
