import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {outcome} from 'alinea/core/Outcome'
import semver from 'compare-versions'
import {reportFatal} from './Report.js'

const require = createRequire(import.meta.url)

export function ensureLibs(libs: Record<string, string>) {
  function fail(message: string) {
    reportFatal(message)
    process.exit(1)
  }
  function ensurePackage(pkg: string, minVersion: string) {
    const [location] = outcome(() => require.resolve(pkg))
    if (!location)
      throw fail(
        `We could not find the ${pkg} package. It's required for the alinea dashboard.\n` +
          `You can install it with: npm i ${pkg}`
      )
    const dir = path.dirname(location)
    const [meta] = outcome(() =>
      fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
    )
    if (!meta) throw fail(`Could not retrieve ${pkg}'s package.json file`)
    const {version} = JSON.parse(meta)
    const pkgVersionWorks = semver.compare(version, minVersion, '>=')
    if (!pkgVersionWorks)
      throw fail(
        `${pkg} version ${version} is not supported, at least ${minVersion} is required\n`
      )
  }
  for (const [pkg, minVersion] of Object.entries(libs)) {
    ensurePackage(pkg, minVersion)
  }
  ensurePackage('react', '18.0.0')
  ensurePackage('react-dom', '18.0.0')
}
