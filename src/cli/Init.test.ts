import {detectPm, init, PM, patchPackageJson} from '#/cli/Init.js'
import {suite} from '@alinea/suite'
import fs from 'node:fs/promises'
import path from 'node:path'

const testPms = false

async function setup(cwd: string) {
  await fs.rm(cwd, {recursive: true}).catch(() => {})
  await fs.mkdir(cwd, {recursive: true})
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
    await fs.mkdir(path.join(cwd, 'src'), {recursive: true})
    await run(cwd)
    const config = await fs.readFile(path.join(cwd, 'src/cms.ts'), 'utf-8')
    test.ok(config.includes("adminPath: '/admin'"))
    test.ok(config.includes("mediaDir: 'public/media'"))
    test.is(config.includes('mediaUrl'), false)
  })
}

test('patchPackageJson keeps indentation', () => {
  const source =
    '{\n    "scripts": {\n        "dev": "next dev",\n        "build": "next build"\n    }\n}\n'
  const patched = patchPackageJson(source)!
  test.is(
    patched.source,
    '{\n    "scripts": {\n        "dev": "alinea dev -- next dev",\n        "build": "alinea build -- next build"\n    }\n}\n'
  )
})

test('patchPackageJson handles minified package.json', () => {
  const patched = patchPackageJson(
    '{"dependencies":{"next":"15"},"scripts":{"dev":"next dev"}}'
  )!
  test.is(
    patched.source,
    '{"dependencies":{"next":"15"},"scripts":{"dev":"alinea dev -- next dev"}}'
  )
})

test('patchPackageJson does not patch twice', () => {
  const source = '{"scripts":{"dev":"alinea dev -- next dev"}}'
  test.is(patchPackageJson(source)!.source, source)
  test.is(patchPackageJson('not json'), undefined)
})

test('detectPm detects bun.lock', async () => {
  const cwd = path.join(process.cwd(), 'dist/.init-pm')
  await fs.rm(cwd, {recursive: true}).catch(() => {})
  await fs.mkdir(cwd, {recursive: true})
  test.is(await detectPm(cwd), PM.NPM)
  await fs.writeFile(path.join(cwd, 'bun.lock'), '')
  test.is(await detectPm(cwd), PM.Bun)
})
