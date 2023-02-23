import {execFileSync} from 'node:child_process'
import path from 'node:path'
import {dirname} from './Dirname'

const __dirname = dirname(import.meta.url)

// Alinea does not require node resolution but many third party packages
// do and this should make using those packages easier
export function ensureNodeResolution() {
  // @ts-ignore
  if (globalThis.Bun) return
  const nodeResolutionFlag = '--experimental-specifier-resolution=node'
  const resolutionSet = process.execArgv.includes(nodeResolutionFlag)

  if (!resolutionSet) {
    try {
      execFileSync(
        process.argv[0],
        process.execArgv
          .concat([
            '-r',
            path.join(__dirname, '../static/supress-warnings.cjs')
          ])
          .concat(nodeResolutionFlag)
          .concat(process.argv.slice(1)),
        {stdio: 'inherit'}
      )
    } catch (e: any) {
      process.exit(e.status)
    }
    process.exit(0)
  }
}
