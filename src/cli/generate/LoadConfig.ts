import {createCMS} from 'alinea/core'
import {CMS} from 'alinea/core/CMS'
import {createRequire} from 'node:module'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

export async function loadCMS(outDir: string): Promise<CMS> {
  const unique = Date.now()
  const genConfigFile = path.join(outDir, 'config.js')
  // Passing a unique identifier makes sure we don't receive the same module
  // from the registry. Unfortunately this also means each config module will
  // remain in memory.
  const outFile = `${pathToFileURL(genConfigFile)}?${unique}`
  global.require = createRequire(import.meta.url)
  const exports = await import(outFile)
  if ('cms' in exports && exports.cms instanceof CMS) return exports.cms
  if ('config' in exports) return createCMS(exports.config)
  throw new Error(`No config found in "${genConfigFile}"`)
}
