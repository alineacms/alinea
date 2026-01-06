import {execSync} from 'node:child_process'
import {readFileSync} from 'node:fs'

const semver = process.argv[2]

if (!semver) {
  console.log('Usage: bun tag <semver>')
  process.exit(1)
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

// Check if requested version has release notes
const changelog = readFileSync('changelog.md', 'utf-8')
if (!changelog.includes(`## [${semver}]`)) {
  console.log(`No release notes found for version ${semver}`)
  process.exit(1)
}

// Tag version
const version = semver.startsWith('v') ? semver : `v${semver}`
execSync(`git tag -a ${version} -m "${version}"`, {stdio: 'inherit'})
execSync('git push --follow-tags', {stdio: 'inherit'})
console.log(`Tagged version ${version} for release`)
