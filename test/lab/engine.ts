/**
 * The lab engine as the website's sync lab page sees it: a view of the
 * world, the packets and events, and the actions the page offers. Built into
 * `apps/web/public/lab` by `bun lab:build`.
 */
import './world/mainRealm.js'
import type {
  InspectSection,
  LabEngine,
  LabView
} from '../../apps/web/src/page/lab/labEngine.js'
import {backendDb} from './world/backendDb.js'
import {addUser, browsers, maxUsers, type Tab} from './world/browsers.js'
import {bus} from './world/bus.js'
import {clock} from './world/clock.js'
import {pageIds, pages} from './world/content.js'
import {dataCache} from './world/dataCache.js'
import {deployments, type Role, roles} from './world/deployments.js'
import {github} from './world/github.js'
import {lab} from './world/lab.js'
import {network} from './world/network.js'
import {runScenario, runs, scenarios} from './world/scenarios.js'

let tables: Array<{name: string; rows: number}> = []
let tablesTimer: ReturnType<typeof setTimeout> | undefined

/** Count rows of the backend database a moment after things changed. */
function refreshTables() {
  if (tablesTimer) return
  tablesTimer = setTimeout(() => {
    tablesTimer = undefined
    backendDb.tables().then(
      next => {
        if (JSON.stringify(next) === JSON.stringify(tables)) return
        tables = next
        bus.changed()
      },
      () => {}
    )
  }, 300)
}

function keyOf(id: string) {
  return pages.find(page => pageIds[page.key] === id)?.key ?? id
}

function findTab(id: number): [(typeof browsers)[number], Tab] {
  for (const browser of browsers) {
    const tab = browser.tabs.find(t => t.id === id)
    if (tab) return [browser, tab]
  }
  throw new Error(`No tab ${id}`)
}

function titleOf(text: string | undefined) {
  try {
    return String(JSON.parse(text ?? '{}').title ?? '')
  } catch {
    return ''
  }
}

function instances(role: Role) {
  const active = deployments.active
  return [0, 1].map(slot => {
    const node = deployments.instanceNode(role, slot)
    const state = bus.states[node]
    const running = Boolean(active?.instances[role][slot])
    return {
      role,
      slot,
      node,
      running,
      warm: Boolean(running && state?.shas?.[role]),
      deployment: active?.n,
      sha: state?.shas?.[role],
      home: state?.titles?.[role]?.[pageIds.home],
      changedAt: state?.syncedAt?.[role],
      queries: state?.resolves ?? 0
    }
  })
}

let cached: {version: number; view: LabView} | undefined

function view(): LabView {
  if (cached?.version === bus.version) return cached.view
  refreshTables()
  const active = deployments.active
  const hasHead = github.commits.length > 0
  const result: LabView = {
    busy: lab.busy,
    mode: lab.mode,
    driver: backendDb.driver,
    latency: network.latency,
    clockOffset: clock.offset,
    head: hasHead ? github.head.contentSha : undefined,
    maxUsers,
    users: browsers.map(browser => ({
      id: browser.id,
      name: browser.user,
      node: browser.node,
      worker: browser.worker,
      storage: browser.storage,
      bases: (bus.states[browser.node]?.bases ?? []).map(
        (base: {
          key: string
          branch: string
          size: number
          parent?: string
        }) => ({
          key: base.key,
          config: base.branch,
          size: base.size,
          parent: base.parent
        })
      ),
      tabs: browser.tabs.map(tab => {
        const save = tab.activities.find(a => a.type === 'mutation')
        return {
          id: tab.id,
          label: tab.label,
          node: tab.node,
          build: tab.build,
          configVersion: tab.configVersion,
          ready: tab.ready,
          sha: tab.sha,
          entries: tab.entries.map(entry => ({...entry, key: keyOf(entry.id)})),
          save: save && {status: save.status, error: save.error},
          catchingUp: tab.activities.some(
            a => a.type === 'sync' && a.status === 'running'
          ),
          progress: tab.progress,
          error: tab.error
        }
      })
    })),
    handlers: instances('handler'),
    pages: instances('pages'),
    routing: deployments.routing,
    deployments: [...deployments.list].reverse().map(d => ({
      n: d.n,
      live: d === active,
      commit: d.commit.id,
      configVersion: d.configVersion,
      mode: d.mode,
      driver: d.driver,
      sha: d.contentSha,
      size: d.database.length
    })),
    git: {
      configVersion: hasHead ? github.head.configVersion : 1,
      files: hasHead
        ? github
            .files()
            .map(({path}) => ({path, title: titleOf(github.read(path))}))
        : [],
      commits: [...github.commits].reverse().map(commit => ({
        id: commit.id,
        sha: commit.contentSha,
        author: commit.author,
        message: commit.message
      }))
    },
    cache: [...dataCache.entries.values()].map(entry => ({
      label: String(JSON.parse(entry.key)[0]),
      value: String(entry.value),
      stale: dataCache.isStale(entry),
      revalidated: entry.revalidated,
      age: Math.round((bus.now() - entry.storedAt) / 1000),
      revalidate: entry.revalidate
    })),
    backend: {
      used: active?.mode !== 'cloud',
      driver: backendDb.driver,
      statements: backendDb.statements,
      tables: tables.filter(table => table.name.startsWith('alinea_'))
    },
    cloud: {active: active?.mode === 'cloud'},
    rendered: Object.fromEntries(
      Object.entries(lab.rendered).map(([node, rendered]) => [
        node,
        rendered && {
          slot: rendered.slot,
          sha: rendered.sha,
          ms: rendered.ms,
          titles: rendered.pages.map(page => page.title),
          error: rendered.error
        }
      ])
    ),
    faults: {...network.faults},
    flashes: bus.flashes,
    scenarios: scenarios.map(scenario => {
      const run = runs[scenario.id]
      return {
        id: scenario.id,
        group: scenario.group,
        title: scenario.title,
        summary: scenario.summary,
        run: run && {
          status: run.status,
          step: run.step,
          checks: [...run.checks]
        }
      }
    })
  }
  cached = {version: bus.version, view: result}
  return result
}

/** Run a lab action that may fail, logging the failure. */
async function attempt<T>(task: () => Promise<T> | T): Promise<void> {
  try {
    await task()
  } catch (error) {
    bus.log({
      node: 'lab',
      kind: 'error',
      text: error instanceof Error ? error.message : String(error)
    })
  }
}

async function exclusive(task: () => Promise<unknown>) {
  if (lab.busy) return
  lab.busy = true
  bus.changed()
  try {
    await task()
  } finally {
    lab.busy = false
    bus.changed()
  }
}

function table(columns: Array<string>, rows: Array<Array<unknown>>) {
  return {columns, rows: rows.map(row => row.map(cell => String(cell ?? '—')))}
}

async function inspect(node: string): Promise<Array<InspectSection>> {
  const short = (sha?: string) => sha?.slice(0, 7) ?? '—'
  const role = roles.find(role => node.startsWith(`${role}-`))
  if (role) {
    const slot = Number(node.slice(-1)) - 1
    const realm = deployments.active?.instances[role][slot]
    if (!realm)
      return [
        {
          title: 'Not running',
          text: 'The next request starts it from the generated database.'
        }
      ]
    const data = await network.call<{
      shas: Record<string, string>
      entries: Record<
        string,
        Array<{
          title: string
          status: string
          filePath: string
          fileHash: string
        }>
      >
    }>(realm, 'inspect')
    return Object.entries(data.entries).map(([store, entries]) => ({
      title: `${store} db at ${short(data.shas[store])}`,
      table: table(
        ['title', 'status', 'file', 'blob'],
        entries.map(e => [e.title, e.status, e.filePath, short(e.fileHash)])
      )
    }))
  }
  const browser = browsers.find(
    b =>
      node === b.node ||
      node === b.worker ||
      node === b.storage ||
      node.startsWith(`${b.node}/`)
  )
  if (browser) {
    const bases = bus.states[browser.node]?.bases ?? []
    const tab = browser.tabs.find(t => t.node === node)
    return [
      ...(tab
        ? [
            {
              title: `${tab.label} at ${short(tab.sha)}`,
              table: table(
                ['entry', 'title', 'status'],
                tab.entries.map(e => [keyOf(e.id), e.title, e.status])
              )
            },
            {
              title: 'Activities of the shared worker',
              code: JSON.stringify(tab.activities.slice(0, 5), null, 2)
            }
          ]
        : []),
      {
        title: 'IndexedDB bases',
        text: 'Each sync saves the store as a base, or a delta over the last one, named after its content sha and config fingerprint. A new store opens the newest base of its fingerprint, or of another config and derives it again.',
        table: table(
          ['content', 'config', 'size', 'over'],
          bases.map(
            (base: {
              key: string
              branch: string
              size: number
              parent?: string
            }) => [
              short(base.key),
              base.branch,
              `${Math.round(base.size / 1024)} KiB`,
              short(base.parent)
            ]
          )
        )
      }
    ]
  }
  switch (node) {
    case 'github':
      return [
        {
          title: 'Files at the head',
          table: table(
            ['file', 'blob', 'title'],
            github.commits.length
              ? github
                  .files()
                  .map(f => [
                    `content/${f.path}`,
                    short(f.sha),
                    titleOf(github.read(f.path))
                  ])
              : []
          )
        },
        {
          title: 'History',
          table: table(
            ['commit', 'content', 'author', 'message'],
            [...github.commits]
              .reverse()
              .map(c => [short(c.id), short(c.contentSha), c.author, c.message])
          )
        }
      ]
    case 'backend-db': {
      const blobs = await backendDb.blobs()
      return [
        {
          title: 'alinea_blob',
          text: 'Content blobs any instance fetched from git or committed: instances that are behind read them here.',
          table: table(
            ['sha', 'size', 'used'],
            blobs.map(b => [
              b.sha.slice(0, 10),
              `${b.size} B`,
              new Date(b.usedAt * 1000).toLocaleTimeString()
            ])
          )
        }
      ]
    }
    case 'data-cache':
      return [
        {
          title: 'Entries',
          code: JSON.stringify([...dataCache.entries.values()], null, 2)
        }
      ]
    case 'build':
      return [
        {
          title: 'Deployments',
          table: table(
            ['#', 'commit', 'content', 'fingerprint', 'handler + pages'],
            deployments.list.map(d => [
              d.n,
              short(d.commit.id),
              short(d.contentSha),
              d.fingerprint,
              roles
                .map(role => d.instances[role].filter(Boolean).length)
                .join(' + ')
            ])
          )
        }
      ]
    case 'visitor':
    case 'preview':
      return [
        {
          title: 'Last render',
          code: JSON.stringify(lab.rendered[node], null, 2)
        }
      ]
  }
  return []
}

export const engine: LabEngine = {
  subscribe: bus.subscribe,
  view,
  packets: () => bus.packets,
  events: () => bus.events,
  inspect,
  actions: {
    reset: options => exclusive(() => lab.reset(options)),
    async runScenario(id) {
      const scenario = scenarios.find(s => s.id === id)
      if (scenario) await runScenario(scenario)
    },
    async runAll() {
      for (const scenario of scenarios) await runScenario(scenario)
    },
    addUser: () => void addUser(),
    openTab: user => attempt(() => lab.browser(user).openTab()),
    closeTab: tab => {
      const [browser, found] = findTab(tab)
      browser.closeTab(found)
    },
    quit: user => lab.browser(user).quit(),
    clearStorage: user => attempt(() => lab.browser(user).clearStorage()),
    save: (tab, entry, title) =>
      attempt(() => {
        const [browser, found] = findTab(tab)
        return browser.save(found, entry, title)
      }),
    preview: (tab, entry, title) =>
      attempt(() => {
        const [browser, found] = findTab(tab)
        return lab.preview(browser, found, entry, title)
      }),
    sync: tab =>
      attempt(() => {
        const [browser, found] = findTab(tab)
        return browser.sync(found)
      }),
    retry: tab =>
      attempt(() => {
        const [browser, found] = findTab(tab)
        return browser.retry(found)
      }),
    discard: tab =>
      attempt(() => {
        const [browser, found] = findTab(tab)
        return browser.discard(found)
      }),
    visit: slot => attempt(() => lab.visit({slot})),
    developerPush: () => attempt(() => lab.developerPush('about')),
    pushConfig: () =>
      attempt(() => lab.pushConfig(github.head.configVersion === 1 ? 2 : 1)),
    deploy: () => attempt(() => lab.deploy()),
    stop: (role, slot) => deployments.stop(role, slot),
    loseNextSave: slot =>
      network.dropNextResponse(
        deployments.instanceNode('handler', slot),
        'mutate'
      ),
    setRouting: routing => {
      deployments.routing = routing
      bus.changed()
    },
    setFault: (node, fault) => network.setFault(node, fault),
    advance: seconds => lab.advance(seconds),
    setLatency: ms => {
      network.latency = ms
      bus.changed()
    },
    purgeCache: () => dataCache.purge(),
    clearEvents: () => bus.clear()
  }
}

let started: Promise<void> | undefined

/** Set up the first world, once per page. */
export function start(): Promise<void> {
  return (started ??= exclusive(() => lab.reset()))
}

// For the console, and for tests driving the page
;(globalThis as {lab?: unknown}).lab = {
  engine,
  bus,
  browsers,
  dataCache,
  deployments,
  github,
  network,
  backendDb,
  lab,
  runScenario,
  runs,
  scenarios
}
