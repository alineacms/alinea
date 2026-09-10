/** Installed-package smoke test: `bun run build && bun test/sqlite-dev.ts`. */
import assert from 'node:assert/strict'
import {execFileSync, spawn, type ChildProcess} from 'node:child_process'
import {once} from 'node:events'
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import {createServer} from 'node:net'
import {join, resolve} from 'node:path'
import {chromium, type Page} from 'playwright'
import {expect} from '@playwright/experimental-ct-react'

const root = resolve(import.meta.dir, '..')
const reloadCount = Number(process.argv[2] ?? 3)
assert(Number.isInteger(reloadCount) && reloadCount >= 1 && reloadCount <= 50)
// Version-manager shims can exit without terminating the actual server child.
const node = execFileSync('node', ['-p', 'process.execPath'], {
  encoding: 'utf8'
}).trim()
await mkdir(join(root, 'private'), {recursive: true})
const project = await mkdtemp(join(root, 'private/sqlite-dev-'))
let server: ChildProcess | undefined
let output = ''
let dashboardPort: number | undefined
let page: Page | undefined
const diagnostics: Array<string> = []
const lifecycleErrors: Array<string> = []
function trace(message: string) {
  diagnostics.push(`${Date.now()} ${message}`)
  if (diagnostics.length > 200) diagnostics.shift()
}
const browser = await chromium.launch({headless: true})

async function stop() {
  if (!server || server.exitCode != null || server.signalCode != null) return
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
  server = undefined
}

async function start(): Promise<string> {
  if (!dashboardPort) {
    const socket = createServer()
    socket.listen(0, '127.0.0.1')
    await once(socket, 'listening')
    const address = socket.address()
    assert(address && typeof address !== 'string')
    dashboardPort = address.port
    await new Promise<void>((resolve, reject) =>
      socket.close(error => (error ? reject(error) : resolve()))
    )
  }
  server = spawn(node, ['server.mjs', String(dashboardPort)], {
    cwd: project,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {...process.env, NODE_ENV: 'development', ALINEA_CLOUD_URL: ''}
  })
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Dev startup timed out\n${output}`)),
      60000
    )
    server!.once('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    server!.once('exit', code => {
      clearTimeout(timeout)
      reject(new Error(`Dev exited ${code}\n${output}`))
    })
    server!.stdout!.on('data', chunk => {
      output += String(chunk)
      process.stdout.write(chunk)
      const ready = String(chunk).match(/FIXTURE_READY (http:\/\/[^\s]+)/)
      if (ready) {
        clearTimeout(timeout)
        resolve(ready[1])
      }
    })
    server!.stderr!.on('data', chunk => {
      output += String(chunk)
      process.stderr.write(chunk)
    })
  })
}

try {
  const installed = join(project, 'node_modules/alinea')
  await mkdir(installed, {recursive: true})
  await cp(join(root, 'dist'), join(installed, 'dist'), {recursive: true})
  await cp(join(root, 'package.json'), join(installed, 'package.json'))
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({name: 'sqlite-dev-fixture', private: true, type: 'module'})
  )
  await writeFile(
    join(project, 'cms.ts'),
    `
import {Config, Field} from 'alinea'
import {createCMS} from 'alinea/core'
export const cms = createCMS({
  schema: {Page: Config.document('Page', {fields: {title: Field.text('Title')}})},
  workspaces: {main: Config.workspace('Main', {
    source: 'content', roots: {pages: Config.root('Pages', {contains: ['Page']})}
  })},
  baseUrl: {production: 'https://sqlite-dev.test', development: 'http://localhost:3000'},
  handlerUrl: '/api/cms', dashboardFile: 'admin.html', enableDrafts: true
})
`
  )
  await mkdir(join(project, 'content/pages'), {recursive: true})
  await writeFile(
    join(project, 'content/pages/home.json'),
    JSON.stringify({
      _id: 'sqlite-home',
      _type: 'Page',
      _index: 'a',
      _root: 'pages',
      title: 'SQLite home'
    })
  )
  await writeFile(
    join(project, 'server.mjs'),
    `
import {serve} from 'alinea/cli/Serve'
await serve({cmd: 'dev', cwd: process.cwd(), port: Number(process.argv[2]),
  buildOptions: {minify: false},
  onAfterGenerate(env) {console.log('FIXTURE_READY ' + env.ALINEA_DEV_SERVER)}
})
`
  )
  page = await browser.newPage()
  page.on('console', message => {
    trace(`console ${message.type()}: ${message.text()}`)
    if (
      message.type() === 'error' &&
      message.text().includes('Dashboard replica disconnected')
    )
      lifecycleErrors.push(message.text())
  })
  page.on('crash', () => trace('page crashed'))
  page.on('requestfailed', request =>
    trace(
      `failed ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`
    )
  )
  page.on('response', response => {
    const url = new URL(response.url())
    const detail =
      url.pathname === '/config.js'
        ? url.search
        : (url.searchParams.get('action') ?? '')
    trace(`response ${response.status()} ${url.pathname} ${detail}`)
  })
  const errors: Array<string> = []
  const actions: Array<string> = []
  let workers = 0
  page.on('worker', worker => {
    workers++
    trace(`worker started ${worker.url()}`)
    worker.on('close', () => trace(`worker closed ${worker.url()}`))
  })
  page.on('pageerror', error => {
    errors.push(error.message)
    console.error(error.message)
  })
  page.on('request', request => {
    const action = new URL(request.url()).searchParams.get('action')
    if (action) actions.push(action)
  })
  const url = await start()
  console.log(`Generated dev server ready: ${url}`)
  await page.goto(url)
  await page
    .getByRole('link', {name: 'SQLite home', exact: true})
    .click({timeout: 30000})
  const title = page.getByRole('textbox', {name: 'Title', exact: true})
  await expect(title).toHaveValue('SQLite home', {timeout: 30000})
  assert(workers > 0, 'Generated dev boot must use a dedicated worker')
  assert(
    actions.includes('replicaIndex'),
    'Generated dashboard must bootstrap the SQLite replica'
  )
  assert(
    actions.includes('replicaPayloads'),
    'Editor must hydrate through authenticated payload transport'
  )
  await title.fill('SQLite saved draft')
  await page.getByRole('button', {name: 'Save draft', exact: true}).click()
  await expect(
    page.getByRole('heading', {name: 'SQLite saved draft', exact: true})
  ).toBeVisible()
  assert(
    actions.includes('mutate'),
    'Save must pass through the Graph mutation handler'
  )
  const content = join(project, 'content')
  const documents = await Promise.all(
    (await readdir(content, {recursive: true}))
      .filter(file => file.endsWith('.json'))
      .map(async file => ({
        file,
        data: JSON.parse(await readFile(join(content, file), 'utf8'))
      }))
  )
  const saved = documents.find(
    document => document.data.title === 'SQLite saved draft'
  )
  assert(saved, 'The saved draft must be on disk before restart')
  await stop()
  const restarted = await start()
  assert.equal(
    restarted,
    url,
    'Restart must reuse the same origin and browser storage'
  )
  await page.goto(restarted)
  await page
    .getByRole('link', {name: 'SQLite saved draft', exact: true})
    .click({timeout: 30000})
  await expect(title).toHaveValue('SQLite saved draft', {timeout: 30000})
  const beforeRefresh = workers
  await writeFile(
    join(content, saved.file),
    JSON.stringify({...saved.data, title: 'SQLite external edit'})
  )
  await expect(title).toHaveValue('SQLite external edit', {timeout: 30000})
  assert.equal(
    workers,
    beforeRefresh,
    'Source refresh must reuse the authenticated worker'
  )
  const configFile = join(project, 'cms.ts')
  let previousLabel = 'Title'
  for (let reload = 1; reload <= reloadCount; reload++) {
    const label = `Title refreshed ${reload}`,
      beforeReload = workers
    trace(`config reload ${reload}`)
    await writeFile(
      configFile,
      (await readFile(configFile, 'utf8')).replace(
        `Field.text('${previousLabel}')`,
        `Field.text('${label}')`
      )
    )
    await expect(
      page.getByRole('textbox', {name: label, exact: true})
    ).toHaveValue('SQLite external edit', {timeout: 30000})
    assert(workers > beforeReload, 'Config reload must replace the worker')
    previousLabel = label
  }
  assert.equal(errors.length, 0, errors.join('\n'))
  assert.equal(lifecycleErrors.length, 0, lifecycleErrors.join('\n'))
  assert(
    (await readdir(join(project, '.alinea/local'))).includes('receipts.sqlite')
  )
  console.log(
    'Generated SQLite dashboard: authenticated boot, lazy hydration, Graph save, same-origin restart, source refresh and config reload passed'
  )
} catch (error) {
  console.error(diagnostics.join('\n'))
  console.error(
    await page
      ?.locator('body')
      .innerText({timeout: 2000})
      .catch(() => 'Page unavailable')
  )
  console.error(output)
  throw error
} finally {
  await browser.close()
  await stop()
  await rm(project, {recursive: true, force: true})
}
