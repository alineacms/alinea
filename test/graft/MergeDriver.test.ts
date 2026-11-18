import {execFileSync, spawnSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {installMergeDriver} from '#/cli/MergeDriver.js'
import {suite} from '@alinea/suite'

const test = suite(import.meta)
const driver = path.join(import.meta.dir, 'driver/Driver.ts')

function repository(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alinea-merge-'))
  git(dir, 'init', '-q', '-b', 'main')
  git(dir, 'config', 'user.name', 'Test')
  git(dir, 'config', 'user.email', 'test@example.com')
  git(dir, 'config', 'commit.gpgsign', 'false')
  return dir
}

function git(cwd: string, ...args: Array<string>): string {
  return execFileSync('git', args, {cwd, encoding: 'utf-8'})
}

const file = 'content/pages/home.json'

function writeEntry(dir: string, data: object) {
  const record = {_id: 'home', _type: 'Page', _index: 'a0', _root: 'pages'}
  fs.mkdirSync(path.join(dir, 'content/pages'), {recursive: true})
  fs.writeFileSync(
    path.join(dir, file),
    JSON.stringify({...record, ...data}, null, '  ')
  )
}

function readEntry(dir: string) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'))
}

function commit(dir: string, message: string) {
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', message)
}

/** A repository where two branches changed different fields of an entry */
function diverged(): string {
  const dir = repository()
  writeEntry(dir, {title: 'Home', body: 'Hello'})
  commit(dir, 'Add home')
  git(dir, 'checkout', '-q', '-b', 'other')
  writeEntry(dir, {title: 'Welcome', body: 'Hello'})
  commit(dir, 'Change title')
  git(dir, 'checkout', '-q', 'main')
  writeEntry(dir, {title: 'Home', body: 'Hello world'})
  commit(dir, 'Change body')
  return dir
}

test('without the driver git conflicts on fields next to each other', () => {
  const dir = diverged()
  const merge = spawnSync('git', ['merge', '-q', 'other', '-m', 'Merge'], {
    cwd: dir
  })
  test.not.is(merge.status, 0)
})

test('install writes the attributes and the git config', async () => {
  const dir = repository()
  const first = await installMergeDriver({
    cwd: dir,
    contentDir: 'content',
    command: `bun ${driver}`
  })
  await installMergeDriver({
    cwd: dir,
    contentDir: 'content',
    command: `bun ${driver}`
  })
  test.is(
    fs.readFileSync(path.join(dir, '.gitattributes'), 'utf-8'),
    'content/**/*.json merge=alinea\n'
  )
  test.is(first.driver, `bun ${driver} merge-driver %O %A %B %P`)
  test.is(git(dir, 'config', 'merge.alinea.driver').trim(), first.driver)
})

test('git merge merges entries field by field', async () => {
  const dir = diverged()
  await installMergeDriver({
    cwd: dir,
    contentDir: 'content',
    command: `bun ${driver}`
  })
  git(dir, 'merge', '-q', 'other', '-m', 'Merge')
  test.equal(readEntry(dir), {
    _id: 'home',
    _type: 'Page',
    _index: 'a0',
    _root: 'pages',
    title: 'Welcome',
    body: 'Hello world'
  })
  test.is(git(dir, 'status', '--porcelain'), '?? .gitattributes\n')
})

test('git pull merges rows added on both sides', async () => {
  const row = (id: string, index: string) => ({
    _id: id,
    _index: index,
    _type: 'Row',
    text: id
  })
  const origin = repository()
  writeEntry(origin, {title: 'Home', rows: [row('a', 'a0')]})
  commit(origin, 'Add home')
  const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'alinea-clone-'))
  git(clone, 'clone', '-q', origin, '.')
  git(clone, 'config', 'user.name', 'Test')
  git(clone, 'config', 'user.email', 'test@example.com')
  git(clone, 'config', 'pull.rebase', 'false')
  await installMergeDriver({
    cwd: clone,
    contentDir: 'content',
    command: `bun ${driver}`
  })
  writeEntry(origin, {title: 'Home', rows: [row('a', 'a0'), row('b', 'a1')]})
  commit(origin, 'Add b')
  writeEntry(clone, {title: 'Home', rows: [row('a', 'a0'), row('c', 'a2')]})
  commit(clone, 'Add c')
  git(clone, 'pull', '-q', '--no-edit')
  test.equal(readEntry(clone).rows, [
    row('a', 'a0'),
    row('b', 'a1'),
    row('c', 'a2')
  ])
})
