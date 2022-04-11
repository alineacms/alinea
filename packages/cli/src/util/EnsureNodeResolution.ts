import {execFileSync} from 'node:child_process'

export function ensureNodeResolution() {
  const nodeResolutionFlag = '--experimental-specifier-resolution=node'
  const resolutionSet = process.execArgv.includes(nodeResolutionFlag)

  if (!resolutionSet) {
    try {
      execFileSync(
        process.argv[0],
        process.execArgv
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
