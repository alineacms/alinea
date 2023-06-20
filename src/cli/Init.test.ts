import {init} from 'alinea/cli/Init'
import fs from 'fs-extra'
import path from 'path'
import {test} from 'uvu'

const testPms = false

async function setup(cwd: string) {
  await fs.remove(cwd)
  await fs.mkdirp(cwd)
  await fs.writeFile(
    path.join(cwd, 'package.json'),
    '{"dependencies": {}, "scripts": {}}'
  )
}

async function run(cwd: string) {
  // process.env.NODE_ENV = 'development'
  await init({cwd, quiet: true})
  /*const cms = await loadCMS(path.join(cwd, '.alinea'))
  const welcome = await cms.get(Page())
  console.log(welcome)
  assert.ok(welcome)*/
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
    const cwd = path.join(process.cwd(), 'dist/.init')
    await setup(cwd)
    await run(cwd)
  })
}

test.run()
