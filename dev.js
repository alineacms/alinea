import path from 'node:path'
import {ensureEnv} from 'alinea/cli/util/EnsureEnv'
import {forwardCommand} from 'alinea/cli/util/ForwardCommand'
import sade from 'sade'

async function run({production, dir, config, role}) {
  ensureEnv(dir)
  const forceProduction = process.env.ALINEA_CLOUD_URL
  process.env.NODE_ENV =
    forceProduction || production ? 'production' : 'development'
  const {serve} = await import('alinea/cli/Serve')
  const onAfterGenerate = forwardCommand()
  return serve({
    alineaDev: true,
    watch: true,
    production,
    base: 'http://localhost:3000',
    cwd: path.resolve(dir),
    configFile: config,
    roles: role && [role].flat().filter(role => typeof role === 'string'),
    staticDir: path.resolve('src/cli/static'),
    port: 4500,
    onAfterGenerate,
    cmd: 'dev',
    buildOptions: {
      minify: false
    }
  })
}

sade('dev', true)
  .option('--production', 'Run in production mode')
  .option('--dir', 'Development directory', 'apps/web')
  .option('--config', 'Config file')
  .option('--role', 'Sign in locally with this role, repeat for more')
  .action(opts => run(opts))
  .parse(process.argv)
