import fs from 'node:fs'
import pkg from './package.json'

const semver = process.argv[2]
pkg.version = semver
// Remove the workspaces property because it is only used internally
delete pkg.workspaces
// Make sure we clear out lifecycle scripts such as postinstall
delete pkg.scripts
// These are definitely not needed in the final package
delete pkg.devDependencies
delete pkg.resolutions
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log(`bumped version to ${semver}`)
