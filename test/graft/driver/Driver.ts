// What git runs for `merge=alinea` in the merge driver test: the driver of
// `alinea merge-driver` with the test's config instead of a compiled one
import {mergeContentFile} from '#/cli/MergeDriver.js'
import {config} from './Config.js'

const [command, base, ours, theirs, path] = process.argv.slice(2)
if (command !== 'merge-driver') throw new Error('Expected merge-driver')
await mergeContentFile(
  config,
  {base, ours, theirs, path},
  {contentDir: 'content'}
)
