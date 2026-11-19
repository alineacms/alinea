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

test('GitHistory leaves out the commit that deleted a version', async () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'alinea-git-history-'))
  tempDirs.push(rootDir)
  git(rootDir, 'init')
  git(rootDir, 'config', 'user.email', 'test@example.com')
  git(rootDir, 'config', 'user.name', 'Test User')
  const write = (file: string, title: string) => {
    // Removing the last file of a directory with git removes the directory
    mkdirSync(join(rootDir, 'content'), {recursive: true})
    writeFileSync(
      join(rootDir, 'content', file),
      JSON.stringify({_id: 'entry', _type: 'Page', _index: 'a', title})
    )
  }
  write('page.json', 'Published')
  git(rootDir, 'add', '.')
  git(rootDir, 'commit', '-m', 'Publish')
  // Unpublishing removes the published file and adds the draft
  git(rootDir, 'rm', '-q', 'content/page.json')
  write('page.draft.json', 'Unpublished draft')
  git(rootDir, 'add', '.')
  git(rootDir, 'commit', '-m', 'Unpublish')

  const history = new GitHistory({} as Config, rootDir)
  const revisions = await history.revisions('content/page.draft.json')

  // Both commits can land in the same second, which orders them
  expect(
    revisions.map(revision => [revision.description, revision.file]).sort()
  ).toEqual([
    ['Publish', 'content/page.json'],
    ['Unpublish', 'content/page.draft.json']
  ])
  for (const revision of revisions)
    await history.revisionData(revision.file, revision.ref)
})

function git(cwd: string, ...args: Array<string>) {
  execFileSync('git', args, {cwd, stdio: 'pipe'})
}

test('GitHistory reads commits with an empty message', async () => {
  const rootDir = mkdtempSync(join(tmpdir(), 'alinea-git-history-'))
  tempDirs.push(rootDir)
  git(rootDir, 'init')
  git(rootDir, 'config', 'user.email', 'test@example.com')
  git(rootDir, 'config', 'user.name', 'Test User')
  mkdirSync(join(rootDir, 'content'), {recursive: true})
  const file = join(rootDir, 'content', 'page.json')
  writeFileSync(file, '{"_id":"entry","_type":"Page","_index":"a","title":"A"}')
  git(rootDir, 'add', '.')
  git(rootDir, 'commit', '-m', 'Create')
  writeFileSync(file, '{"_id":"entry","_type":"Page","_index":"a","title":"B"}')
  git(rootDir, 'add', '.')
  git(rootDir, 'commit', '--allow-empty-message', '-m', '')

  const history = new GitHistory({} as Config, rootDir)
  const revisions = await history.revisions('content/page.json')

  expect(revisions).toHaveLength(2)
  expect(
    revisions.every(revision => revision.file === 'content/page.json')
  ).toBe(true)
  for (const revision of revisions)
    await history.revisionData(revision.file, revision.ref)
})
