import {CMS} from 'alinea/core/CMS'
import {values} from 'alinea/core/util/Objects'
import {createRequire} from 'node:module'
import path from 'node:path'
import {GenerateContext} from './GenerateContext.js'

export async function loadCMS({outDir}: GenerateContext): Promise<CMS> {
  const unique = Date.now()
  const genConfigFile = path.join(outDir, 'config.js').replace(/\\/g, '/')
  // Passing a unique identifier makes sure we don't receive the same module
  // from the registry. Unfortunately this also means each config module will
  // remain in memory.
  const outFile = `file://${genConfigFile}?${unique}`
  global.require = createRequire(import.meta.url)
  const exports = await import(outFile)
  for (const member of values(exports)) {
    if (member instanceof CMS) return member
  }
  throw new Error(`No config found in "${genConfigFile}"`)
}
