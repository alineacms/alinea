import path from 'node:path'
import {suite} from '@alinea/suite'
import {init} from 'alinea/cli/Init'
import fs from 'fs-extra'

const testPms = false

async function setup(cwd: string) {
  await fs.remove(cwd)
  await fs.mkdirp(cwd)
  await fs.writeFile(
    path.join(cwd, 'package.json'),
    '{"dependencies": {}, "scripts": {"dev": "next dev"}}'
  )
}

async function run(cwd: string) {
  await init({cwd, quiet: true, next: true})
}

const test = suite(import.meta)

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
    const cwd = path.join(process.cwd(), 'dist/.init')
    await setup(cwd)
    await fs.mkdirp(path.join(cwd, 'src'))
    await run(cwd)
  })
}
