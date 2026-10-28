import {codeHash} from '#/cli/util/CodeHash.js'
import {suite} from '@alinea/suite'
import {execSync} from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const test = suite(import.meta)

test('codeHash', async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'alinea-hash-'))
  const cwd = path.join(repo, 'site')
  const sh = (cmd: string) => execSync(cmd, {cwd, encoding: 'utf8'}).trim()
  async function commit(file: string, data: string) {
    await fs.mkdir(path.dirname(path.join(repo, file)), {recursive: true})
    await fs.writeFile(path.join(repo, file), data)
    sh(`git add -A && git commit -qm ${JSON.stringify(file)}`)
  }
  try {
    await fs.mkdir(cwd)
    sh(
      'git init -q .. && git config user.email a@b && git config user.name a && ' +
        'git config commit.gpgsign false'
    )
    test.is(await codeHash(cwd, 'content'), undefined)
    await commit('site/content/page.json', '{}')
    await commit('site/src/cms.ts', 'a')
    const hash = await codeHash(cwd, 'content')
    test.is(
      hash,
      sh(
        `git ls-tree -r --full-tree HEAD | ` +
          `grep -v "$(printf '\\tsite/content/')" | git hash-object --stdin`
      )
    )
    await commit('site/content/page.json', '{"title": "a"}')
    test.is(await codeHash(cwd, 'content'), hash)
    await commit('lib/index.ts', 'b')
    test.not.is(await codeHash(cwd, 'content'), hash)
  } finally {
    await fs.rm(repo, {recursive: true, force: true})
  }
})
