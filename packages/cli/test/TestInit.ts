import {Pages} from '@alinea/backend/Pages'
import {init} from '@alinea/cli/Init'
import {Entry} from '@alinea/core/Entry'
import fs from 'fs-extra'
import path from 'path'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

const testPms = false

async function setup(cwd: string) {
  await fs.remove(cwd)
  await fs.mkdirp(cwd)
}

async function run(cwd: string) {
  await init({cwd, quiet: true})
  const exports = await import(
    `file://${path.resolve(cwd, '.alinea/main/pages')}`
  )
  const pages: Pages<Entry> = exports.pages
  const welcome = await pages.where(page => page.title.is('Welcome'))
  assert.ok(welcome)
}

if (testPms) {
  test('npm', async () => {
    const cwd = 'dist/.test/npm'
    await setup(cwd)
    await fs.writeFile(
      path.join(cwd, 'package.json'),
      '{"dependencies": {}, "scripts": {}}'
    )
    await fs.writeFile(path.join(cwd, 'package-lock.json'), '{}')
    await run(cwd)
  })

  test('yarn', async () => {
    const cwd = 'dist/.test/yarn'
    await setup(cwd)
    await fs.writeFile(
      path.join(cwd, 'package.json'),
      '{"dependencies": {}, "scripts": {}}'
    )
    await fs.writeFile(path.join(cwd, 'yarn.lock'), '')
    await run(cwd)
  })

  test('pnpm', async () => {
    const cwd = 'dist/.test/pnpm'
    await setup(cwd)
    await fs.writeFile(
      path.join(cwd, 'package.json'),
      '{"dependencies": {}, "scripts": {}}'
    )
    await fs.writeFile(path.join(cwd, 'pnpm-lock.yaml'), '')
    await run(cwd)
  })
} else {
  test('init', async () => {
    const cwd = 'dist/.init'
    await setup(cwd)
    await run(cwd)
  })
}

test.run()
