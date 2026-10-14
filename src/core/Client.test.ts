import {composeBackend} from '#/backend/api/CreateBackend.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import type {AuthedContext} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {suite} from '@alinea/suite'
import {Client} from './Client.js'
import {UnknownTreeError} from './source/UnknownTreeError.js'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {title: Field.text('Title')}
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

/** Serve requests on a local port while the test runs. */
async function serve(
  fetch: (request: Request) => Response | Promise<Response>,
  run: (client: Client) => Promise<void>
) {
  const server = Bun.serve({port: 0, fetch})
  try {
    await run(
      new Client({config: cms.config, url: `http://localhost:${server.port}`})
    )
  } finally {
    server.stop(true)
  }
}

test('a store behind syncs the changes through the handler', async () => {
  const remoteDb = new LocalDB(cms.config)
  const home = await remoteDb.create({type: Page, set: {title: 'Home'}})
  await remoteDb.create({type: Page, set: {title: 'About'}})
  const handle = createHandler({
    cms,
    db: new LocalDB(cms.config),
    remote(context) {
      return composeBackend(remoteDb, {
        async verify(): Promise<AuthedContext> {
          return {...context, token: 'test', user: {sub: 'admin', roles: []}}
        }
      })
    }
  })
  const requests = Array<string>()
  const context = {
    apiKey: 'test',
    handlerUrl: new URL('http://localhost/api'),
    isDev: true
  }
  await serve(
    request => {
      const params = new URL(request.url).searchParams
      requests.push(params.has('changes') ? 'changes' : params.get('action')!)
      return handle(request, context)
    },
    async client => {
      const local = new LocalDB(cms.config)
      const titles = (db: LocalDB) =>
        db.find({type: Page, select: Entry.title, status: 'all'})
      await local.syncWith(client)
      await remoteDb.update({type: Page, id: home._id, set: {title: 'Welcome'}})
      await local.syncWith(client)
      test.is(await local.sha, await remoteDb.sha)
      test.equal(await titles(local), await titles(remoteDb))
      test.equal(requests, ['changes', 'changes'])
      await local.syncWith(client)
      test.equal(requests, ['changes', 'changes', 'changes'])
    }
  )
})

test('changes a handler cannot tell are an unknown tree', async () => {
  const answers: Array<unknown> = [
    {unknown: true},
    // A handler from before changes sends the whole tree
    {sha: 'b'.repeat(40), entries: []}
  ]
  await serve(
    () => Response.json(answers.shift()),
    async client => {
      for (let i = 0; i < 2; i++) {
        const error = await client.getChanges('a'.repeat(40)).catch(e => e)
        test.ok(error instanceof UnknownTreeError)
      }
    }
  )
})
