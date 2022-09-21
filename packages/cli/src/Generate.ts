import {createDb} from '@alinea/backend/util/CreateDb'
import {Config} from '@alinea/core/Config'
import {Outcome} from '@alinea/core/Outcome'
import {SqliteStore} from '@alinea/store/sqlite/SqliteStore'
import path from 'node:path'
import {dirname} from './util/Dirname'

const __dirname = dirname(import.meta.url)

export type GenerateOptions = {
  cwd?: string
  staticDir?: string
  configFile?: string
  watch?: boolean
  fix?: boolean
  canReIndex?: () => boolean
  onConfigRebuild?: (outcome: Outcome<Config>) => void
  onCacheRebuild?: (outcome: Outcome<SqliteStore>) => void
  wasmCache?: boolean
  quiet?: boolean
  store?: SqliteStore
  onAfterGenerate?: () => void
}

export async function generate(options: GenerateOptions): Promise<Config> {
  const {
    wasmCache = false,
    cwd = process.cwd(),
    configFile = 'alinea.config',
    staticDir = path.join(__dirname, 'static'),
    quiet = false,
    onConfigRebuild,
    onCacheRebuild
  } = options
  const store = options.store || (await createDb())
  let cacheWatcher: Promise<{stop: () => void}> | undefined
  let generating: Promise<void> | undefined
  const configLocation = path.join(cwd, configFile)
  const outDir = path.join(cwd, '.alinea')
  const watch = options.watch || onConfigRebuild || onCacheRebuild

  await copyBoilerplate()
  await compileConfig()
  await copyStaticFiles()
  let {config, reloadConfig} = await loadConfig()
  await (generating = generatePackage())
  if (options.onAfterGenerate) options.onAfterGenerate()
  return config

  async function generatePackage() {
    if (cacheWatcher) (await cacheWatcher).stop()
    await Promise.all([
      generateWorkspaces(config),
      (cacheWatcher = fillCache(config))
    ])
    const dashboard = config.dashboard
    if (dashboard?.staticFile)
      await generateDashboard(dashboard.handlerUrl, dashboard.staticFile!)
  }
}
