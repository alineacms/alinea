/** Run explicitly with `bun test/sqlite-next.ts`; builds and runs real Next. */
import assert from 'node:assert/strict'
import {spawn, type ChildProcess} from 'node:child_process'
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
import {createRequire} from 'node:module'
import {createServer} from 'node:net'
import {join, relative, resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {Config, Field} from '#/index.js'
import {createEntryResolver} from '#test/EntryFixture.js'
import {exportDatabase} from '#/cli/generate/ExportDatabase.js'

const root = resolve(import.meta.dir, '..')
await mkdir(join(root, 'private'), {recursive: true})
const project = await mkdtemp(join(root, 'private/sqlite-next-'))
const relocated = await mkdtemp(join(tmpdir(), 'alinea-next-standalone-'))
const require = createRequire(import.meta.url)
const privateMarker = 'PRIVATE_SQLITE_CANARY_4be10dbd'
let server: ChildProcess | undefined

async function files(directory: string): Promise<Array<string>> {
  const result: Array<string> = []
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...(await files(path)))
    else result.push(path)
  }
  return result
}

try {
  const generated = join(project, 'node_modules/@alinea/generated')
  await mkdir(generated, {recursive: true})
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({name: 'sqlite-next-fixture', private: true, type: 'module'})
  )
  await writeFile(
    join(generated, 'package.json'),
    JSON.stringify({
      name: '@alinea/generated',
      type: 'module',
      exports: {
        './package.json': './package.json',
        './database.js': './database.js'
      }
    })
  )
  const Page = Config.document('Page', {fields: {title: Field.text('Title')}})
  const config = {
    schema: {Page},
    workspaces: {
      main: Config.workspace('Main', {
        source: 'content',
        roots: {pages: Config.root('Pages', {contains: ['Page']})}
      })
    }
  }
  const {source} = await createEntryResolver(config, [
    {id: 'private-entry', type: 'Page', index: 'a', title: privateMarker}
  ])
  await exportDatabase(
    config,
    source,
    generated,
    {
      project: 'project',
      epoch: 'epoch',
      schemaId: 'schema',
      configId: 'integration',
      namespace: 'preview/test',
      releaseId: 'test-release'
    },
    join(project, 'public', '_alinea', 'payloads')
  )
  const bundled = await Bun.build({
    entrypoints: [join(root, 'src/adapter/next/with-alinea.ts')],
    target: 'node',
    format: 'esm',
    external: ['next']
  })
  assert(bundled.success)
  await writeFile(
    join(project, 'with-alinea.mjs'),
    await bundled.outputs[0].text()
  )
  await writeFile(
    join(project, 'next.config.mjs'),
    `import {withAlinea} from './with-alinea.mjs';
export default withAlinea({output: 'standalone', distDir: 'custom-next', outputFileTracingRoot: ${JSON.stringify(root)}, env: {ALINEA_ADMIN_PATH: '/admin'}, experimental: {cpus: 1}}, {databaseRoutes: ['/api/content']});`
  )
  await mkdir(join(project, 'app/api/content'), {recursive: true})
  await mkdir(join(project, 'app/unrelated'), {recursive: true})
  await writeFile(
    join(project, 'app/layout.js'),
    `export default function Layout({children}) { return <html><body>{children}</body></html> }`
  )
  await writeFile(
    join(project, 'app/client.js'),
    `'use client'; export default function Client() { return <span>Client boundary</span> }`
  )
  await writeFile(
    join(project, 'app/read.js'),
    `import {openDatabase} from '@alinea/generated/database.js';
export async function read() { const db = await openDatabase({schema: {}, workspaces: {}}); try { return await db.count({}) } finally { db.close() } }`
  )
  await writeFile(
    join(project, 'app/page.js'),
    `import {read} from './read.js'; import Client from './client.js'; export const dynamic = 'force-dynamic'; export default async function Page() { return <main>Entries: {await read()}<Client/></main> }`
  )
  await writeFile(
    join(project, 'app/api/content/route.js'),
    `import {read} from '../../read.js'; export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export async function GET() { return Response.json({count: await read()}) }`
  )
  await writeFile(
    join(project, 'app/unrelated/page.js'),
    `export default function Page() { return <p>Unrelated</p> }`
  )
  const build = spawn(
    'node',
    [
      require.resolve('next/dist/bin/next'),
      'build',
      process.argv.includes('--turbopack') ? '--turbopack' : '--webpack'
    ],
    {
      cwd: project,
      stdio: 'inherit',
      env: {...process.env, NEXT_TELEMETRY_DISABLED: '1'}
    }
  )
  const [code] = await once(build, 'exit')
  assert.equal(code, 0, 'Next build failed')
  const output = join(project, 'custom-next')
  for (const route of ['page', 'api/content/route']) {
    const trace = JSON.parse(
      await readFile(join(output, `server/app/${route}.js.nft.json`), 'utf8')
    ) as {files: Array<string>}
    assert(
      trace.files.some(file => file.endsWith('release.sqlite')),
      `SQLite absent from ${route} trace`
    )
  }
  for (const path of await files(join(output, 'static'))) {
    assert(!path.endsWith('.sqlite'), 'Private SQLite leaked into static files')
    const content = await readFile(path)
    assert(
      !content.includes(privateMarker),
      'Private data leaked into a client asset'
    )
  }
  const unrelated = JSON.parse(
    await readFile(
      join(output, 'server/app/unrelated/page.js.nft.json'),
      'utf8'
    )
  ) as {files: Array<string>}
  assert(
    !unrelated.files.some(file => file.endsWith('release.sqlite')),
    'Unrelated route received the private database'
  )
  await cp(join(output, 'standalone'), relocated, {
    recursive: true,
    verbatimSymlinks: true
  })
  const app = join(relocated, relative(root, project))
  await cp(join(output, 'static'), join(app, 'custom-next/static'), {
    recursive: true
  })
  // Remove all fixture source files before starting the relocated deployment.
  await rm(project, {recursive: true, force: true})
  const probe = createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const address = probe.address()
  assert(address && typeof address !== 'string')
  const port = address.port
  await new Promise<void>((resolve, reject) =>
    probe.close(error => (error ? reject(error) : resolve()))
  )
  server = spawn('node', [join(app, 'server.js')], {
    cwd: relocated,
    env: {...process.env, HOSTNAME: '127.0.0.1', PORT: String(port)},
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Standalone startup timed out')),
      30000
    )
    function output(chunk: Buffer) {
      process.stdout.write(chunk)
      if (chunk.toString().includes('Ready')) {
        clearTimeout(timeout)
        resolve()
      }
    }
    server!.stdout!.on('data', output)
    server!.stderr!.on('data', chunk => process.stderr.write(chunk))
    server!.once('exit', code => {
      clearTimeout(timeout)
      reject(new Error(`Standalone exited: ${code}`))
    })
  })
  await ready
  const response = await fetch(`http://127.0.0.1:${port}/api/content`, {
    signal: AbortSignal.timeout(15000)
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {count: 1})
  const page = await fetch(`http://127.0.0.1:${port}/`, {
    signal: AbortSignal.timeout(15000)
  })
  assert.equal(page.status, 200)
  assert((await page.text()).includes('Entries:'))
  console.log(
    'Verified: Node page/route traces, private client boundary, and relocated standalone SQLite reads.'
  )
} finally {
  if (server) {
    // Bun's ChildProcess exit/signal getters differ from Node before exit.
    // Always request shutdown of the child owned by this fixture.
    const exited = once(server, 'exit')
    server.kill('SIGTERM')
    let timeout: ReturnType<typeof setTimeout> | undefined
    await Promise.race([
      exited,
      new Promise<void>(resolve => {
        timeout = setTimeout(() => {
          server?.kill('SIGKILL')
          resolve()
        }, 5000)
      })
    ])
    clearTimeout(timeout)
    server.stdout?.destroy()
    server.stderr?.destroy()
  }
  await rm(project, {recursive: true, force: true})
  await rm(relocated, {recursive: true, force: true})
}
