import {execFileSync, spawnSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {suite} from '@alinea/suite'

const test = suite(import.meta)

// The ignoreCommand of the vercel.json the instant publishing guide gives
function strings(value: unknown): Array<string> {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object')
    return Object.values(value).flatMap(strings)
  return []
}
const guide = path.join(
  import.meta.dir,
  '../../apps/web/content/main/pages/docs/guides/instant-publishing.json'
)
const snippet = strings(JSON.parse(fs.readFileSync(guide, 'utf-8'))).find(
  text => text.includes('"ignoreCommand"')
)!
const ignoreCommand: string = JSON.parse(snippet).ignoreCommand

function repository() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alinea-skip-'))
  const git = (...args: Array<string>) =>
    execFileSync('git', args, {cwd: dir, encoding: 'utf-8'})
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'Test')
  git('config', 'user.email', 'test@example.com')
  git('config', 'commit.gpgsign', 'false')
  fs.mkdirSync(path.join(dir, 'content'))
  fs.writeFileSync(path.join(dir, 'content/a.json'), '{}')
  fs.writeFileSync(path.join(dir, 'app.ts'), '')
  git('add', '-A')
  git('commit', '-q', '-m', 'Start')
  return {dir, git}
}

function skips(trailer: string, file: string): boolean {
  const {dir, git} = repository()
  fs.writeFileSync(path.join(dir, file), '{"changed": true}')
  git('commit', '-q', '-am', `Update\n\n${trailer}: abc`)
  return spawnSync('sh', ['-c', ignoreCommand], {cwd: dir}).status === 0
}

test('content commits of alinea and of graft skip the build', () => {
  test.ok(skips('Alinea-Content', 'content/a.json'))
  test.ok(skips('Graft-Content', 'content/a.json'))
})

test('commits that change code still build', () => {
  test.not.ok(skips('Graft-Content', 'app.ts'))
  test.not.ok(skips('Other', 'content/a.json'))
})
