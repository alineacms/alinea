import {execSync} from 'node:child_process'
import {write} from 'bun'
// @ts-ignore
import pkg from './package.json'

let semver = process.argv[2]

if (!semver) {
  const current = pkg.version
  const isCleanSemver = /^\d+\.\d+\.\d+$/.test(current)
  if (!isCleanSemver) {
    console.log('Current version cannot be bumped')
    process.exit(1)
  }
  const [major, minor, patch] = current.split('.')
  semver = `${major}.${minor}.${Number(patch) + 1}`
}

// Check if we're on main branch
const branch = execSync('git branch --show-current').toString().trim()
if (branch !== 'main') {
  console.log('Not on main branch')
  process.exit(1)
}
// Check if we're behind origin
const behind = execSync('git fetch && git rev-list HEAD..origin/main --count')
  .toString()
  .trim()
if (behind !== '0') {
  console.log('Not up to date with origin/main')
  process.exit(1)
}
// Check if we're clean
const changes = execSync('git status --porcelain').toString().trim()
if (changes) {
  console.log('Working directory is not clean')
  process.exit(1)
}
// Bump version
const version = semver.startsWith('v') ? semver : `v${semver}`
pkg.version = version.slice(1)
await write('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
execSync('git add .', {stdio: 'inherit'})
execSync(`git commit -m "${version}"`, {stdio: 'inherit'})
execSync(`git tag -a ${version} -m "${version}"`, {stdio: 'inherit'})
execSync('git push --follow-tags', {stdio: 'inherit'})
console.log(`Bumped version to ${version}`)
