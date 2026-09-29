import {existsSync} from 'node:fs'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createCMS} from '#/core.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import {localUser} from '#/core/User.js'
import {Config} from '#/index.js'
import {suite} from '@alinea/suite'
import type {Plugin} from 'esbuild'
import {createLocalServer} from './CreateLocalServer.js'
import {LiveReload} from './LiveReload.js'

const test = suite(import.meta)

const cms = createCMS({
  schema: {Page: Config.document('Page', {fields: {}})},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      mediaDir: 'public/media',
      roots: {pages: Config.root('Pages'), media: Config.media()}
    })
  }
})

// Builds every module of the dashboard as an empty file
const emptyBuild: Plugin = {
  name: 'empty',
  setup(build) {
    build.onResolve({filter: /.*/}, args => ({
      path: args.path,
      namespace: 'empty'
    }))
    build.onLoad({filter: /.*/, namespace: 'empty'}, () => ({contents: ''}))
  }
}

async function setup() {
  const rootDir = await mkdtemp(join(tmpdir(), 'alinea-local-server-'))
  const server = createLocalServer(
    {
      cmd: 'dev',
      configLocation: join(rootDir, 'cms.ts'),
      rootDir,
      staticDir: rootDir,
      alineaDev: false,
      buildOptions: {plugins: [emptyBuild]},
      production: false,
      liveReload: new LiveReload(),
      buildId: 'test',
      apiKey: 'dev'
    },
    cms,
    async () => new Response('api'),
    localUser,
    {sync: async () => {}} as unknown as LocalStore
  )
  return {
    rootDir,
    handle: server.handle,
    async [Symbol.asyncDispose]() {
      server.close()
      await rm(rootDir, {recursive: true, force: true})
    }
  }
}

test('serves MCP only on its own path', async () => {
  await using env = await setup()
  const mcp = await env.handle(new Request('http://localhost:4500/mcp'))
  test.is(mcp.status, 405)
  // The Next dev rewrite forwards adminPath requests from the network
  const proxied = await env.handle(
    new Request('http://localhost:4500/admin/mcp', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'ping'})
    })
  )
  test.is(proxied.status, 404)
})

test('uploads only into a media dir', async () => {
  await using env = await setup()
  function upload(file: string) {
    return env.handle(
      new Request(
        `http://localhost:4500/admin?/upload&file=${encodeURIComponent(file)}`,
        {method: 'POST', body: 'file'}
      )
    )
  }
  for (const file of ['../escape.txt', 'public/media/../../x.txt', 'cms.ts']) {
    const response = await upload(file)
    test.is(response.status, 400)
  }
  test.not.ok(existsSync(join(env.rootDir, '..', 'escape.txt')))
  test.not.ok(existsSync(join(env.rootDir, 'cms.ts')))
  const ok = await upload('public/media/..photo.jpg')
  test.is(ok.status, 200)
  test.is(
    await readFile(join(env.rootDir, 'public/media/..photo.jpg'), 'utf8'),
    'file'
  )
})
