import {forwardCommand} from 'alinea/cli/util/ForwardCommand'
import dotenv from 'dotenv'
import findConfig from 'find-config'
import path from 'node:path'
import sade from 'sade'

async function run({production, dir, config}) {
  const forceProduction = process.env.ALINEA_CLOUD_URL
  dotenv.config({path: findConfig('.env')})
  process.env.NODE_ENV =
    forceProduction || production ? 'production' : 'development'
  const {serve} = await import('alinea/cli/Serve')
  return serve({
    alineaDev: true,
    production,
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
  .option('--config', `Config file`, 'src/cms')
  .action(opts => run(opts))
  .parse(process.argv)
