import {Config} from '@alinea/core/Config'
import {createError} from '@alinea/core/ErrorWithCode'
import path from 'node:path'
import {GenerateContext} from './GenerateContext'

export async function loadConfig({outDir}: GenerateContext) {
  const unique = Date.now()
  const genConfigFile = path.join(outDir, 'config.js')
  const outFile = `file://${genConfigFile}?${unique}`
  const exports = await import(outFile)
  const config: Config = exports.config
  if (!config) throw createError(`No config found in "${genConfigFile}"`)
  return config
}
