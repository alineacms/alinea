import semver from 'compare-versions'

// Alinea does not require node resolution but many third party packages
// do and this should make using those packages easier
export function ensureNode() {
  // @ts-ignore
  if (globalThis.Bun) return
  if (!process.version) return
  const isValidNode = semver.compare(process.version, '18.0.0', '>=')
  if (isValidNode) return
  console.error(`Alinea requires Node version 18 or higher`)
  process.exit(1)

  /*
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
  }*/
}
