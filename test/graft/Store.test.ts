import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import type {GraftApi} from '#/backend/api/GraftApi.js'
import {graft, type ReplicaOptions} from '#/backend/api/graft.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import type {AuthedContext, RequestContext} from '#/core/Connection.js'
import type {Mutation} from '#/core/db/Mutation.js'
import {Entry} from '#/core/Entry.js'
import {getScope} from '#/core/Scope.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {readCommit, readFile} from '@alinea/graft'
import {suite} from '@alinea/suite'
import {Database as BunDatabase} from 'bun:sqlite'
import {connect} from 'rado/driver/bun-sqlite'
import {git, gitHost, workingCopy} from './support/GitHttp.js'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {body: Field.text('Body', {multiline: true})}
})
const cms = createCMS({
  schema: {Page},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})
const config = cms.config

const token = 'editor-token'

interface Server {
  api: GraftApi
  db: LocalDB
  handle(request: Request): Promise<Response>
  url: string
}

/** The content deployed with the build */
async function build(): Promise<LocalDB> {
  const db = new LocalDB(config)
  await db.create({type: Page, id: 'home', set: {title: 'Home', body: 'Hi'}})
  return db
}

function server(
  api: GraftApi,
  db: LocalDB,
  url = 'http://localhost/api'
): Server {
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(api, {
        async verify(request): Promise<AuthedContext> {
          const header = request.headers.get('authorization')
          if (header !== `Bearer ${token}`) throw new Error('Unauthorized')
          return {
            ...context,
            token,
            user: {
              sub: 'ada',
              name: 'Ada',
              email: 'ada@example.com',
              roles: ['admin']
            }
          }
        }
      })
    }
  })
  const context: RequestContext = {
    apiKey: 'test',
    handlerUrl: new URL(url),
    isDev: false
  }
  return {api, db, url, handle: request => handle(request, context)}
}

function store(replicas: Array<ReplicaOptions> = [], webhookSecret?: string) {
  return graft({replicas, webhookSecret})(
    {apiKey: 'test', handlerUrl: new URL('http://localhost/api'), isDev: false},
    config
  )
}

async function mutate(server: Server, mutations: Array<Mutation>) {
  const response = await server.handle(
    new Request(`${server.url}?action=mutate`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(mutations)
    })
  )
  test.is(response.status, 200)
}

async function read(server: Server) {
  const response = await server.handle(
    new Request(`${server.url}?action=resolve`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`
      },
      body: getScope(config).stringify({
        first: true,
        id: 'home',
        select: Entry.data,
        syncInterval: 0
      })
    })
  )
  test.is(response.status, 200)
  return response.json()
}

function update(set: Record<string, unknown>): Mutation {
  return {op: 'update', id: 'home', locale: null, status: 'published', set}
}

async function headFile(api: GraftApi, file = 'content/pages/home.json') {
  const head = await api.repo.refs.get(api.ref)
  const {tree} = await readCommit(api.repo.objects, head!)
  const contents = await readFile(api.repo.objects, tree, file)
  return contents && JSON.parse(new TextDecoder().decode(contents))
}

test('the content deployed with the build is imported once', async () => {
  const api = store()
  const deployed = await build()
  const first = server(api, deployed)
  const second = server(api, await build())
  await Promise.all([read(first), read(second)])
  const head = await api.repo.refs.get(api.ref)
  const commit = await readCommit(api.repo.objects, head!)
  test.equal(commit.parents, [])
  test.equal(await api.getTreeIfDifferent(await deployed.sha), undefined)
})

test('saves are commits, and history comes from them', async () => {
  const api = store()
  const s = server(api, await build())
  await mutate(s, [update({title: 'Welcome'})])
  test.is((await headFile(api)).title, 'Welcome')
  const revisions = await api.revisions('content/pages/home.json')
  test.is(revisions.length, 2)
  test.equal(revisions[0].user, {name: 'Ada', email: 'ada@example.com'})
  const before = await api.revisionData(
    'content/pages/home.json',
    revisions[1].ref
  )
  test.is(before?.title, 'Home')
})

test('a save made from an older state merges with what landed since', async () => {
  const api = store()
  const s = server(api, await build())
  // Another server's index, still at the content of the build
  const stale = await build()
  await read(s)
  await mutate(s, [update({title: 'Welcome'})])
  const request = await stale.request([update({body: 'Hello world'})])
  await api.write(request)
  const file = await headFile(api)
  test.is(file.title, 'Welcome')
  test.is(file.body, 'Hello world')
})

test('replicas receive the content when it is read', async () => {
  using host = gitHost()
  const api = store([{name: 'site', url: host.url, direction: 'mirror'}])
  const s = server(api, await build())
  await mutate(s, [update({title: 'Welcome'})])
  await read(s)
  const file = JSON.parse(host.git('show', 'main:content/pages/home.json'))
  test.is(file.title, 'Welcome')
  test.ok(
    host.git('log', '-1', '--format=%B', 'main').includes('Graft-Content')
  )
})

test('a developer push reaches the store through the webhook', async () => {
  using host = gitHost()
  const dev = await workingCopy(host)
  fs.writeFileSync(path.join(dev.dir, 'README.md'), 'Site\n')
  await dev.git('add', '-A')
  await dev.git('commit', '-q', '-m', 'Start')
  await dev.git('push', '-q', 'origin', 'HEAD:main')
  const secret = 'a-secret-of-sixteen-chars'
  const api = store(
    [{name: 'site', url: host.url, direction: 'two-way'}],
    secret
  )
  const s = server(api, await build())
  // The first read seeds the store, the second replicates
  await read(s)
  await read(s)
  await dev.git('pull', '-q', '--no-rebase', 'origin', 'main')
  const file = path.join(dev.dir, 'content/pages/home.json')
  const record = JSON.parse(fs.readFileSync(file, 'utf-8'))
  fs.writeFileSync(
    file,
    JSON.stringify({...record, body: 'From git'}, null, '  ')
  )
  await dev.git('commit', '-q', '-am', 'Edit body')
  await dev.git('push', '-q', 'origin', 'HEAD:main')
  const response = await s.handle(
    new Request(`${s.url}?action=replicate&secret=${secret}`, {method: 'POST'})
  )
  test.is(response.status, 200)
  test.is((await headFile(api)).body, 'From git')
  test.is((await read(s)).body, 'From git')
})

test('git clones the content through the handler', async () => {
  const api = store()
  let s: Server | undefined
  const http = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch: request => s!.handle(request)
  })
  try {
    s = server(api, await build(), `http://127.0.0.1:${http.port}/api`)
    await read(s)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alinea-clone-'))
    const url = `http://user:${token}@127.0.0.1:${http.port}/api/git/`
    await git(dir, 'clone', '-q', url, '.')
    const file = JSON.parse(
      fs.readFileSync(path.join(dir, 'content/pages/home.json'), 'utf-8')
    )
    test.is(file.title, 'Home')
    const denied = await git(
      dir,
      'clone',
      '-q',
      `http://user:wrong@127.0.0.1:${http.port}/api/git/`,
      'denied'
    ).then(
      () => true,
      () => false
    )
    test.not.ok(denied)
  } finally {
    http.stop(true)
  }
})

test('a two-way replica holding content is imported instead of the build', async () => {
  using host = gitHost()
  const dev = await workingCopy(host)
  const file = path.join(dev.dir, 'content/pages/home.json')
  fs.mkdirSync(path.dirname(file), {recursive: true})
  const record = {
    _id: 'home',
    _type: 'Page',
    _index: 'a0',
    _root: 'pages',
    title: 'From the repository',
    body: 'Hi'
  }
  fs.writeFileSync(file, JSON.stringify(record, null, '  '))
  await dev.git('add', '-A')
  await dev.git('commit', '-q', '-m', 'Content')
  await dev.git('push', '-q', 'origin', 'HEAD:main')
  const api = store([{name: 'site', url: host.url, direction: 'two-way'}])
  const s = server(api, await build())
  test.is((await read(s)).title, 'From the repository')
})

test('the store keeps its content in the project database', async () => {
  const database = connect(new BunDatabase(':memory:'))
  const api = graft({database})(
    {apiKey: 'test', handlerUrl: new URL('http://localhost/api'), isDev: false},
    config
  )
  const s = server(api, await build())
  await mutate(s, [update({title: 'Welcome'})])
  // Another process opening the same database sees the save
  const other = graft({database})(
    {apiKey: 'test', handlerUrl: new URL('http://localhost/api'), isDev: false},
    config
  )
  test.is((await headFile(other)).title, 'Welcome')
})
