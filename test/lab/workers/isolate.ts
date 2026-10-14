/**
 * A serverless isolate of a deployment: the Next.js route handler and the
 * CMS of server renders, each on its own copy of the generated database, as
 * `alinea/next` sets them up. Both are Alinea's own classes; only the host
 * around them is the lab's.
 */
import {
  callMain,
  handle,
  identity,
  pendingTimers,
  ready,
  reportState,
  trace
} from '../shared/realm.js'
import {BasicAuth} from '#/backend/api/BasicAuth.js'
import {composeBackend} from '#/backend/api/CreateBackend.js'
import {DatabaseApi} from '#/backend/api/DatabaseApi.js'
import {createGeneratedDatabase} from '#/backend/store/GeneratedDatabase.js'
import {NextCMS} from '#/adapter/next/cms.js'
import {createHandlerWithDatabase} from '#/adapter/next/handler.js'
import {CloudRemote} from '#/cloud/CloudRemote.js'
import type {RequestContext} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import type {LocalStore} from '#/core/db/LocalStore.js'
import type {User} from '#/core/User.js'
import {openWasmDatabase} from '#/database/driver/WasmDatabase.js'
import type {EntryStore} from '#/database/EntryStore.js'
import {connect as connectD1} from 'rado/driver/d1'
import {connect as connectLibsql} from 'rado/driver/libsql'
import {
  instrument,
  label,
  listEntries,
  resolveCount
} from '../shared/instrument.js'
import {LabGithub, labD1, labLibsql} from '../shared/remotes.js'
import {type ConfigVersion, labConfig} from '../shared/schema.js'
import {renderScope} from '../shims/requestScope.js'
import type {SerializedRequest, SerializedResponse} from '../shared/protocol.js'

instrument()

const data = identity.data as {
  deployment: string
  configVersion: ConfigVersion
  mode: 'self-hosted' | 'cloud'
  driver: 'libsql' | 'd1'
}
const config = labConfig(data.configVersion)
const stores: Record<string, EntryStore> = {}
const syncedAt: Record<string, number> = {}

function users(username: string, password: string): User | false {
  if (password !== 'password') return false
  return {
    sub: username,
    email: `${username}@lab`,
    name: username,
    roles: ['admin']
  }
}

/**
 * The generated database of the deployment, read into memory: the wasm
 * fallback of `runtimeDatabase` where the native overlay VFS is missing.
 */
function openGenerated(name: 'handler' | 'pages') {
  return async (): Promise<LocalStore> => {
    const bytes = await callMain<Uint8Array>('deployment.database', {
      deployment: data.deployment
    })
    const store = await createGeneratedDatabase(
      config,
      await openWasmDatabase(bytes)
    )
    label(store, name)
    stores[name] = store
    store.onChange(change => {
      syncedAt[name] = Date.now()
      trace({
        node: name,
        kind: 'index',
        text: `${name} db at ${change.revision.slice(0, 7)}: ${change.changedEntryIds.length} entr${change.changedEntryIds.length === 1 ? 'y' : 'ies'} changed`
      })
    })
    trace({
      node: name,
      kind: 'open',
      text: `opened generated database (${Math.round(bytes.length / 1024)} KiB) as in-memory copy at ${(await store.sha).slice(0, 7)}`
    })
    void report()
    return store
  }
}

// The driver is part of the deployment, like the backend options it built
const backendDb =
  data.driver === 'd1' ? connectD1(labD1() as any) : connectLibsql(labLibsql())

const cms = new NextCMS(config, openGenerated('pages'))
const handler = createHandlerWithDatabase(
  {
    cms,
    backend(context: RequestContext) {
      const auth = new BasicAuth(context, users)
      if (data.mode === 'cloud')
        return composeBackend(new CloudRemote(context, config), auth)
      return composeBackend(
        auth,
        new LabGithub(),
        new DatabaseApi(context, {db: backendDb})
      )
    },
    afterCommit({sha, entries}) {
      trace({
        node: 'handler',
        kind: 'hook',
        text: `afterCommit ${sha.slice(0, 7)}: ${entries.map(e => e.title).join(', ')}`
      })
    }
  },
  openGenerated('handler')
)

async function serializeResponse(
  response: Response
): Promise<SerializedResponse> {
  return {
    status: response.status,
    headers: [...response.headers],
    body: response.body ? new Uint8Array(await response.arrayBuffer()) : null
  }
}

async function state() {
  const shas: Record<string, string> = {}
  const titles: Record<string, Record<string, string>> = {}
  for (const [name, store] of Object.entries(stores)) {
    shas[name] = await store.sha
    const rows = await store.find({
      type: config.schema.Page,
      select: {id: Entry.id, title: Entry.title}
    })
    titles[name] = Object.fromEntries(rows.map(row => [row.id, row.title]))
  }
  return {
    titles,
    deployment: data.deployment,
    shas,
    syncedAt,
    resolves: resolveCount(),
    timers: pendingTimers()
  }
}

async function report() {
  reportState(await state())
}

let renders = Promise.resolve()

handle('request', async (request: SerializedRequest) => {
  const response = await handler(
    new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body as BodyInit | null
    })
  )
  const result = await serializeResponse(response)
  void report()
  return result
})

interface RenderRequest {
  path: string
  draft?: boolean
  cookies?: Array<{name: string; value: string}>
}

/** Render a page of the site, one render at a time. */
handle('render', (request: RenderRequest) => {
  const run = async () => {
    renderScope.draft = Boolean(request.draft)
    renderScope.cookies = request.cookies ?? []
    const start = performance.now()
    try {
      const pages = await cms.find({
        type: config.schema.Page,
        select: {
          id: Entry.id,
          title: Entry.title,
          path: Entry.path,
          status: Entry.status,
          body: config.schema.Page.body
        }
      })
      const status = await cms.status()
      return {
        pages,
        sha: status.sha,
        syncedAt: status.syncedAt?.getTime(),
        ms: Math.round(performance.now() - start)
      }
    } finally {
      renderScope.draft = false
      renderScope.cookies = []
      void report()
    }
  }
  const result = renders.then(run, run)
  renders = result.then(
    () => {},
    () => {}
  )
  return result
})

handle('inspect', async () => {
  const entries: Record<string, unknown> = {}
  for (const [name, store] of Object.entries(stores))
    entries[name] = await listEntries(store)
  return {...(await state()), entries}
})

handle('warm', async () => {
  await cms.bundledDb
  await handler(
    new Request(`${config.baseUrl}/api?action=capabilities`, {
      headers: {accept: 'application/json'}
    })
  )
  return state()
})

ready()
