import type {Config} from '#/core/Config.js'
import {afterEach, expect, test} from 'bun:test'
import {execFileSync} from 'node:child_process'
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {GitHistory} from './GitHistory.js'

const tempDirs = Array<string>()

afterEach(() => {
  for (const dir of tempDirs.splice(0))
    rmSync(dir, {recursive: true, force: true})
})

test('GitHistory preserves unicode paths from git history', async () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'alinea-git-history-'))
  tempDirs.push(rootDir)
  git(rootDir, 'init')
  git(rootDir, 'config', 'user.email', 'test@example.com')
  git(rootDir, 'config', 'user.name', 'Test User')

  const file = 'content/primary/pages/nl/unicộde-tést.json'
  const absoluteFile = join(rootDir, ...file.split('/'))
  mkdirSync(join(rootDir, 'content', 'primary', 'pages', 'nl'), {
    recursive: true
  })
  writeFileSync(
    absoluteFile,
    '{"_id":"entry","_type":"Page","_index":"a","title":"First"}'
  )
  git(rootDir, 'add', file)
  git(rootDir, 'commit', '-m', 'Initial unicode file')
  writeFileSync(
    absoluteFile,
    '{"_id":"entry","_type":"Page","_index":"a","title":"Second"}'
  )
  git(rootDir, 'add', file)
  git(rootDir, 'commit', '-m', 'Update unicode file')

  const history = new GitHistory({} as Config, rootDir)
  const revisions = await history.revisions(file)

  expect(revisions).toHaveLength(2)
  expect(revisions.every(revision => revision.file === file)).toBe(true)
  expect(
    await history.revisionData(revisions[0].file, revisions[0].ref)
  ).toEqual({_id: 'entry', _type: 'Page', _index: 'a', title: 'Second'})
})

function git(cwd: string, ...args: Array<string>) {
  execFileSync('git', args, {cwd, stdio: 'pipe'})
}
