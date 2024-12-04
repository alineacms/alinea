import {write} from 'bun'
import pkg from './package.json'

const semver = process.argv[2]
pkg.version = semver
// Remove the workspaces property because it is only used internally
delete pkg.workspaces
await write('package.json', JSON.stringify(pkg, null, 2) + '\n')
console.log(`bumped version to ${semver}`)