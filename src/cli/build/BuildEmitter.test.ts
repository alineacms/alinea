import {suite} from '@alinea/suite'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {buildEmitter} from './BuildEmitter.js'

const test = suite(import.meta)

function entryFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-emitter-'))
  const entry = path.join(dir, 'entry.ts')
  fs.writeFileSync(entry, 'export const value = 1\n')
  return {dir, entry}
}

test('builds once without watching', async () => {
  const {dir, entry} = entryFile()
  const builds = buildEmitter(
    {entryPoints: [entry], outdir: path.join(dir, 'out'), write: false},
    {watch: false}
  )
  const iterator = builds[Symbol.asyncIterator]()
  const types: Array<string> = []
  while (true) {
    const {value, done} = await iterator.next()
    if (done) break
    types.push(value.type)
    if (value.type !== 'done') continue
    test.is(value.result.errors.length, 0)
    // A change must not trigger another build: there is no watcher
    fs.writeFileSync(entry, 'export const value = 2\n')
    const next = await Promise.race([
      iterator.next().then(() => 'build'),
      new Promise(resolve => setTimeout(() => resolve('idle'), 500))
    ])
    test.is(next, 'idle')
    break
  }
  builds.return()
  test.equal(types, ['start', 'done'])
})
