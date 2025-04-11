import {$} from 'bun'

const semver = process.argv[2]
const version = semver.startsWith('v') ? semver : `v${semver}`
await $`git tag -a ${version} -m "${version}"`
await $`git push --follow-tags`
