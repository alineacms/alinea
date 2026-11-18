import {composeBackend} from '#/backend/api/CreateBackend.js'
import {graft} from '#/backend/api/graft.js'
import {createHandler} from '#/backend/Handler.js'
import {createCMS} from '#/core.js'
import type {AuthedContext, RequestContext} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {createRecord, parseRecord} from '#/core/EntryRecord.js'
import {contentRoot} from '#/core/graft/Roots.js'
import {Schema} from '#/core/Schema.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {LiveSession} from '#/dashboard/live/LiveSession.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Config, Field} from '#/index.js'
import {type Json, readCommit, readFile, type Shape} from '@alinea/graft'
import {suite} from '@alinea/suite'
import {createStore} from 'jotai'

const test = suite(import.meta)

const Page = Config.document('Page', {
  fields: {body: Field.text('Body', {multiline: true})}
})
const main = Config.workspace('Main', {
  source: 'content',
  roots: {pages: Config.root('Pages')}
})
const cms = createCMS({schema: {Page}, workspaces: {main}})
const shape = Schema.shape(cms.config.schema)

/** The schema of a deploy that added a field */
const newer = Schema.shape(
  Config.create({
    schema: {
      Page: Config.document('Page', {
        fields: {
          body: Field.text('Body', {multiline: true}),
          intro: Field.text('Intro')
        }
      })
    },
    workspaces: {main}
  }).schema
)

const token = 'editor-token'

async function setup() {
  const api = graft({sessions: true})(
    {apiKey: 'test', handlerUrl: new URL('http://localhost/api'), isDev: false},
    cms.config
  )
  const db = new LocalDB(cms.config)
  await db.create({type: Page, id: 'home', set: {title: 'Home', body: 'Hi'}})
  const handle = createHandler({
    cms,
    db,
    remote(context) {
      return composeBackend(api, {
        async verify(request): Promise<AuthedContext> {
          const header = request.headers.get('authorization')
          if (header !== `Bearer ${token}`) throw new Error('Unauthorized')
          const name = request.headers.get('x-editor') ?? 'Ada'
          return {
            ...context,
            token,
            user: {
              sub: name,
              name,
              email: `${name.toLowerCase()}@example.com`,
              roles: ['admin']
            }
          }
        }
      })
    }
  })
  const context: RequestContext = {
    apiKey: 'test',
    handlerUrl: new URL('http://localhost/api'),
    isDev: false
  }
  const fetch = (request: Request) => handle(request, context)
  // The first sync imports the build's content into the store
  await api.seed(db)
  const entry = await db.get({id: 'home', select: Entry})
  async function stored() {
    const head = await api.repo.refs.get(api.ref)
    const {tree} = await readCommit(api.repo.objects, head!)
    const file = await readFile(
      api.repo.objects,
      tree,
      `${contentRoot}/${entry.filePath}`
    )
    return JSON.parse(new TextDecoder().decode(file))
  }

  function dashboard(
    name: string,
    options: {shape?: Shape; reload?(): Promise<Shape>} = {}
  ) {
    const store = createStore()
    const node = new ReactiveNode<Record<string, unknown>>({...entry.data})
    const session = new LiveSession({
      url: 'http://localhost/api/session',
      headers: {authorization: `Bearer ${token}`, 'x-editor': name},
      fetch,
      branch: api.ref,
      path: `${contentRoot}/${entry.filePath}`,
      shape: options.shape ?? shape,
      reload: options.reload,
      store,
      value: node.value,
      toRecord: data => createRecord({...entry, data}, entry.status) as Json,
      fromRecord: (record, current) => ({
        ...parseRecord(record as any).data,
        path: current.path
      })
    })
    return {
      session,
      edit(field: string, value: unknown) {
        store.set(node.field(field), value)
      },
      get value() {
        return store.get(node.value)
      }
    }
  }
  return {dashboard, stored}
}

async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++)
    await new Promise(resolve => setTimeout(resolve, 20))
  return check()
}

test('two dashboards editing an entry converge', async () => {
  const {dashboard, stored} = await setup()
  const ada = dashboard('Ada')
  const bob = dashboard('Bob')
  await ada.session.start()
  await bob.session.start()
  ada.edit('title', 'Welcome home')
  bob.edit('body', 'Hello there')
  const converged = () =>
    ada.value.title === 'Welcome home' &&
    ada.value.body === 'Hello there' &&
    bob.value.title === 'Welcome home' &&
    bob.value.body === 'Hello there'
  test.ok(await until(converged))
  test.equal(
    ada.session.others.map(other => other.author.name),
    ['Bob']
  )
  await ada.session.stop()
  await bob.session.stop()
  // The last to leave closes the session, which saves to the branch
  const file = await stored()
  test.is(file.title, 'Welcome home')
  test.is(file.body, 'Hello there')
})

test('a dashboard on another schema reloads it and joins', async () => {
  const {dashboard} = await setup()
  const ada = dashboard('Ada')
  await ada.session.start()
  let reloads = 0
  const behind = dashboard('Bob', {
    shape: newer,
    async reload() {
      reloads++
      return shape
    }
  })
  await behind.session.start()
  test.is(reloads, 1)
  behind.edit('body', 'From the reloaded dashboard')
  test.ok(await until(() => ada.value.body === 'From the reloaded dashboard'))
  await ada.session.stop()
  await behind.session.stop()
})

test('a session that closed is followed by a fresh one', async () => {
  const {dashboard, stored} = await setup()
  const ada = dashboard('Ada')
  await ada.session.start()
  ada.edit('title', 'First session')
  await ada.session.flush()
  await ada.session.stop()
  test.is((await stored()).title, 'First session')
  const bob = dashboard('Bob')
  await bob.session.start()
  test.is(bob.value.title, 'First session')
  bob.edit('body', 'Second session')
  await bob.session.stop()
  test.is((await stored()).body, 'Second session')
})
