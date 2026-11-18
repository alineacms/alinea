import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {FSSource} from '#/core/source/FSSource.js'
import {suite} from '@alinea/suite'
import {stagedFiles} from './StagedFiles.js'

const test = suite(import.meta)

function repository() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alinea-staged-'))
  const git = (...args: Array<string>) =>
    execFileSync('git', args, {cwd: dir, encoding: 'utf-8'})
  git('init', '-q')
  fs.mkdirSync(path.join(dir, 'content/pages'), {recursive: true})
  fs.writeFileSync(path.join(dir, 'content/pages/a.json'), '{"title":"A"}')
  fs.writeFileSync(path.join(dir, 'content/pages/b.json'), '{"title":"B"}')
  fs.writeFileSync(path.join(dir, 'readme.md'), 'Site')
  // Staged a second after writing, so no entry is racily clean
  const past = new Date(Date.now() - 5000)
  for (const file of ['content/pages/a.json', 'content/pages/b.json'])
    fs.utimesSync(path.join(dir, file), past, past)
  git('add', '-A')
  return {dir, git}
}

test('reads the files git stages below a directory', async () => {
  const {dir, git} = repository()
  const staged = await stagedFiles(path.join(dir, 'content'))
  test.equal([...staged!.keys()].sort(), ['pages/a.json', 'pages/b.json'])
  test.is(
    staged!.get('pages/a.json')!.sha,
    git('hash-object', 'content/pages/a.json').trim()
  )
})

test('reads nothing where a checkout writes CRLF line endings', async () => {
  const {dir, git} = repository()
  git('config', 'core.autocrlf', 'true')
  test.is(await stagedFiles(path.join(dir, 'content')), undefined)
  git('config', 'core.autocrlf', 'false')
  fs.writeFileSync(path.join(dir, '.gitattributes'), '*.json eol=crlf\n')
  test.is(await stagedFiles(path.join(dir, 'content')), undefined)
})

test('text normalized to LF checks out as staged', async () => {
  const {dir} = repository()
  fs.writeFileSync(path.join(dir, '.gitattributes'), '* text=auto\n')
  if (process.platform === 'win32') return
  test.ok(await stagedFiles(path.join(dir, 'content')))
})

test('a cold start takes the staged sha of a file whose stat matches', async () => {
  const {dir} = repository()
  const content = path.join(dir, 'content')
  const staged = (await stagedFiles(content))!
  const hashed = await new FSSource(content).getTree()
  const source = new FSSource(content)
  source.stage(staged)
  test.is((await source.getTree()).sha, hashed.sha)
  // A file changed since it was staged is read and hashed
  fs.writeFileSync(path.join(content, 'pages/b.json'), '{"title":"Bee"}')
  const changed = new FSSource(content)
  changed.stage(staged)
  const tree = await changed.getTree()
  test.is(
    tree.get('pages/b.json')!.sha,
    (await new FSSource(content).getTree()).get('pages/b.json')!.sha
  )
  // A staged sha is trusted without reading the file
  const trusted = new FSSource(content)
  const fake = '0'.repeat(40)
  trusted.stage(
    new Map([['pages/a.json', {...staged.get('pages/a.json')!, sha: fake}]])
  )
  test.is((await trusted.getTree()).get('pages/a.json')!.sha, fake)
})
