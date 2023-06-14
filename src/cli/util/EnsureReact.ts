import {outcome} from 'alinea/core/Outcome'
import semver from 'compare-versions'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

export function ensureReact() {
  function fail(message: string) {
    console.error(message)
    process.exit(1)
  }
  function ensurePackage(pkg: string, minVersion: string) {
    const location = outcome(() => require.resolve(pkg))
    if (!location.isSuccess())
      throw fail(
        `We could not find the ${pkg} package. It's required for the alinea dashboard.\n` +
          `You can install it with: npm i ${pkg}`
      )
    const dir = path.dirname(location.value)
    const meta = outcome(() =>
      fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
    )
    if (!meta.isSuccess())
      throw fail(`Could not retrieve ${pkg}'s package.json file`)
    const {version} = JSON.parse(meta.value)
    const pkgVersionWorks = semver.compare(version, minVersion, '>=')
    if (!pkgVersionWorks)
      throw fail(
        `${pkg} version ${version} is not supported, at least ${minVersion} is required\n`
      )
  }
  ensurePackage('react', '18.0.0')
  ensurePackage('react-dom', '18.0.0')
}
