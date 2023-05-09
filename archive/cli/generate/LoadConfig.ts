import {Config} from 'alinea/core/Config'
import {createError} from 'alinea/core/ErrorWithCode'
import {createRequire} from 'node:module'
import path from 'node:path'
import {GenerateContext} from './GenerateContext.js'

export async function loadConfig({outDir}: GenerateContext): Promise<Config> {
  const unique = Date.now()
  const genConfigFile = path.join(outDir, 'config.js').replace(/\\/g, '/')
  // Passing a unique identifier makes sure we don't receive the same module
  // from the registry. Unfortunately this also means each config module will
  // remain in memory.
  const outFile = `file://${genConfigFile}?${unique}`
  global.require = createRequire(import.meta.url)
  const exports = await import(outFile)
  const config: Config = exports.config
  if (!config) throw createError(`No config found in "${genConfigFile}"`)
  return config
}
