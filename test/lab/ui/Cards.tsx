import {useEffect, useState} from 'react'
import type {Activity} from '#/dashboard/boot/ActivityEvent.js'
import {backendDb} from '../world/backendDb.js'
import type {Browser, Tab} from '../world/browsers.js'
import {bus} from '../world/bus.js'
import {clock} from '../world/clock.js'
import {pageIds, pages} from '../world/content.js'
import {dataCache} from '../world/dataCache.js'
import {deployments} from '../world/deployments.js'
import {github} from '../world/github.js'
import {lab} from '../world/lab.js'
import {type Fault, network} from '../world/network.js'
import {Sha} from './Sha.js'

function act(task: () => Promise<unknown> | unknown) {
  return () => {
    void Promise.resolve()
      .then(task)
      .catch(error => {
        bus.log({
          node: 'lab',
          kind: 'error',
          text: error instanceof Error ? error.message : String(error)
        })
      })
  }
}

function keyOf(id: string) {
  return pages.find(page => pageIds[page.key] === id)?.key ?? id
}

function ago(at?: number) {
  if (!at) return 'never'
  const seconds = Math.round((bus.now() - at) / 1000)
  if (seconds < 1) return 'just now'
  if (seconds < 120) return `${seconds}s ago`
  return `${Math.round(seconds / 60)}m ago`
}

// Browsers ------------------------------------------------------------------

export function BrowserCard({id}: {id: string}) {
  const browser = lab.browser(id)
  const state = bus.states[browser.node] ?? {}
  const bases: Array<{key: string; branch: string; size: number}> =
    state.bases ?? []
  const busy = lab.busy
  return (
    <div className="stack">
      <div className="row">
        <button
          type="button"
          disabled={busy}
          onClick={act(() => browser.openTab())}
        >
          + tab
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={act(() => browser.quit())}
          title="Close every tab and stop the shared workers"
        >
          quit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={act(() => browser.clearStorage())}
          title="Delete the IndexedDB of this browser"
        >
          clear data
        </button>
        <span
          className="muted"
          title={bases
            .map(
              b => `${b.key} (${b.branch}, ${Math.round(b.size / 1024)} KiB)`
            )
            .join('\n')}
        >
          IndexedDB: {bases.length} base{bases.length === 1 ? '' : 's'}
        </span>
      </div>
      {browser.tabs.length === 0 && (
        <p className="muted">
          No tabs open. A tab starts the shared worker of the deployed
          dashboard.
        </p>
      )}
      {browser.tabs.map(tab => (
        <TabView key={tab.id} browser={browser} tab={tab} />
      ))}
    </div>
  )
}

function TabView({browser, tab}: {browser: Browser; tab: Tab}) {
  const [editing, setEditing] = useState<string>()
  const [value, setValue] = useState('')
  const activity = tab.activities.find(a => a.type === 'mutation')
  const sync = tab.activities.find(
    a => a.type === 'sync' && a.status === 'running'
  )
  const failed = tab.activities.some(
    a => a.status === 'failed' || a.status === 'blocked'
  )
  return (
    <div className="tab">
      <div className="row">
        <b>{tab.label}</b>
        <Sha sha={tab.sha} title="Worker store" />
        <span
          className="muted"
          title="Dashboard build: one shared worker per build"
        >
          {tab.build.replace('dashboard-', '')}
        </span>
        {activity && <Status activity={activity} />}
        {sync && <span className="badge badge-running">catching up</span>}
        {tab.progress && (
          <span className="badge badge-running">
            {tab.progress.loaded}/{tab.progress.total}
          </span>
        )}
        <span className="spacer" />
        <button
          type="button"
          className="small"
          onClick={act(() => browser.sync(tab))}
          title="Sync the worker now (it does every 120s)"
        >
          ⟳
        </button>
        <button
          type="button"
          className="small"
          onClick={act(() => browser.closeTab(tab))}
          title="Close tab"
        >
          ×
        </button>
      </div>
      {tab.error && <p className="error">{tab.error}</p>}
      {failed && (
        <div className="row">
          <button
            type="button"
            className="small"
            onClick={act(() => browser.retry(tab))}
          >
            retry
          </button>
          <button
            type="button"
            className="small"
            onClick={act(() => browser.discard(tab))}
          >
            discard
          </button>
        </div>
      )}
      <ul className="entries">
        {tab.entries.map(entry => (
          <li key={entry.id}>
            {editing === entry.id ? (
              <form
                className="row"
                onSubmit={event => {
                  event.preventDefault()
                  setEditing(undefined)
                  act(() => browser.save(tab, entry.id, value))()
                }}
              >
                <input
                  value={value}
                  autoFocus
                  onChange={event => setValue(event.target.value)}
                />
                <button type="submit" className="small">
                  save
                </button>
                <button
                  type="button"
                  className="small"
                  onClick={act(() =>
                    lab.preview(browser, tab, entry.id, value)
                  )}
                  title="Render a draft with this title, without saving"
                >
                  preview
                </button>
                <button
                  type="button"
                  className="small"
                  onClick={() => setEditing(undefined)}
                >
                  ×
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="entry"
                onClick={() => {
                  setEditing(entry.id)
                  setValue(entry.title)
                }}
                title="Edit the title"
              >
                <span className="entry-key">{keyOf(entry.id)}</span>{' '}
                {entry.title} <span className="muted">✎</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Status({activity}: {activity: Activity}) {
  return (
    <span
      className={`badge badge-${activity.status}`}
      title={
        activity.error ??
        activity.operations.map(o => `${o.op} ${o.title ?? ''}`).join(', ')
      }
    >
      save {activity.status}
    </span>
  )
}

// Site ------------------------------------------------------------------------

function RenderedView({node}: {node: string}) {
  const rendered = lab.rendered[node]
  if (!rendered) return <p className="muted">Nothing rendered yet.</p>
  return (
    <div className="stack">
      <div className="row">
        <span className="muted">λ{rendered.slot + 1}</span>
        <Sha sha={rendered.sha} title="Content sha of the render" />
        <span className="muted">{rendered.ms}ms</span>
      </div>
      {rendered.error && <p className="error">{rendered.error}</p>}
      <ul className="titles">
        {rendered.pages.map(page => (
          <li key={page.id}>{page.title}</li>
        ))}
      </ul>
    </div>
  )
}

export function VisitorCard() {
  return (
    <div className="stack">
      <div className="row">
        <button
          type="button"
          disabled={lab.busy}
          onClick={act(() => lab.visit())}
          title="The edge picks an isolate"
        >
          visit
        </button>
        <button
          type="button"
          className="small"
          disabled={lab.busy}
          onClick={act(() => lab.visit({slot: 0}))}
        >
          λ1
        </button>
        <button
          type="button"
          className="small"
          disabled={lab.busy}
          onClick={act(() => lab.visit({slot: 1}))}
        >
          λ2
        </button>
      </div>
      <RenderedView node="visitor" />
    </div>
  )
}

export function PreviewCard() {
  return (
    <div className="stack">
      <p className="muted">Edit a title in a tab, then press preview.</p>
      <RenderedView node="preview" />
    </div>
  )
}

const faults: Array<[string, Fault | '']> = [
  ['ok', ''],
  ['down', 'down'],
  ['hangs', 'hang'],
  ['loses answers', 'drop-response']
]

function FaultSelect({node}: {node: string}) {
  return (
    <label className="fault" title="What this node does with requests">
      <select
        value={network.faults[node] ?? ''}
        onChange={event =>
          network.setFault(node, (event.target.value || undefined) as Fault)
        }
      >
        {faults.map(([label, value]) => (
          <option key={label} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function IsolateCard({slot}: {slot: number}) {
  const node = deployments.isolateNode(slot)
  const deployment = deployments.active
  const running = Boolean(deployment?.isolates[slot])
  const state = bus.states[node]
  const home = pageIds.home
  const pinned = deployments.routing === slot
  return (
    <div className="stack">
      <div className="row">
        <span
          className={`badge ${running ? (state?.shas ? 'badge-succeeded' : 'badge-running') : ''}`}
        >
          {running ? (state?.shas ? 'warm' : 'starting') : 'not running'}
        </span>
        {deployment && <span className="muted">deploy #{deployment.n}</span>}
        <span className="spacer" />
        <FaultSelect node={node} />
      </div>
      {(['handler', 'cms'] as const).map(store => (
        <div className="row db-row" key={store}>
          <span className="db-name">{store} db</span>
          <Sha
            sha={state?.shas?.[store]}
            title={`${store} copy of the generated database`}
          />
          <span className="db-title">
            {state?.titles?.[store]?.[home] ?? ''}
          </span>
        </div>
      ))}
      <div className="row muted">
        handler db changed {ago(state?.syncedAt?.handler)} ·{' '}
        {state?.resolves ?? 0} queries
      </div>
      <div className="row">
        <button
          type="button"
          className="small"
          onClick={() => {
            deployments.routing = pinned ? 'alternate' : (slot as 0 | 1)
            bus.changed()
          }}
          title="Route every request of the site here"
        >
          {pinned ? '● pinned' : 'pin route'}
        </button>
        <button
          type="button"
          className="small"
          disabled={!running}
          onClick={act(() => deployments.stop(slot))}
          title="Stop this instance, as a host does after it idled"
        >
          stop
        </button>
        <button
          type="button"
          className="small"
          onClick={act(() => network.dropNextResponse(node, 'mutate'))}
          title="The next save this isolate handles runs, but its answer never arrives"
        >
          lose save answer
        </button>
      </div>
    </div>
  )
}

export function BuildCard() {
  const list = [...deployments.list].reverse().slice(0, 4)
  return (
    <div className="stack">
      <div className="row">
        <button
          type="button"
          disabled={lab.busy || !github.commits.length}
          onClick={act(() => lab.deploy())}
        >
          deploy head
        </button>
        <label className="muted">
          edge{' '}
          <select
            value={String(deployments.routing)}
            onChange={event => {
              const value = event.target.value
              deployments.routing =
                value === 'alternate' ? 'alternate' : (Number(value) as 0 | 1)
              bus.changed()
            }}
          >
            <option value="alternate">alternates</option>
            <option value="0">λ1 only</option>
            <option value="1">λ2 only</option>
          </select>
        </label>
      </div>
      <ul className="list">
        {list.map(deployment => (
          <li
            key={deployment.id}
            className={deployment === deployments.active ? '' : 'retired'}
          >
            <div className="row">
              <b>#{deployment.n}</b>
              <Sha sha={deployment.contentSha} title="Generated database" />
              <span className="muted">
                config v{deployment.configVersion} · {deployment.mode}
                {deployment.mode === 'self-hosted'
                  ? ` · ${deployment.driver}`
                  : ''}
              </span>
            </div>
            <div className="muted small-text">
              {deployment === deployments.active ? 'live' : 'retired'} · commit{' '}
              {deployment.commit.id.slice(0, 7)} ·{' '}
              {Math.round(deployment.database.length / 1024)} KiB
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Services ------------------------------------------------------------------

export function CacheCard() {
  const entries = [...dataCache.entries.values()]
  return (
    <div className="stack">
      {entries.length === 0 && <p className="muted">Empty.</p>}
      {entries.map(entry => {
        const stale = dataCache.isStale(entry)
        const age = Math.round((bus.now() - entry.storedAt) / 1000)
        return (
          <div className="row" key={entry.key}>
            <span className="db-name">
              {JSON.parse(entry.key)[0].replace('alinea-', '')}
            </span>
            {typeof entry.value === 'string' && entry.value.length === 40 ? (
              <Sha sha={entry.value} title="Cached content sha" />
            ) : (
              <span>{String(entry.value)}</span>
            )}
            <span
              className={`badge ${stale ? 'badge-failed' : 'badge-succeeded'}`}
            >
              {stale
                ? entry.revalidated
                  ? 'revalidated'
                  : 'expired'
                : `${age}s/${entry.revalidate}s`}
            </span>
          </div>
        )
      })}
      <div className="row">
        <button
          type="button"
          className="small"
          onClick={() => dataCache.purge()}
        >
          purge
        </button>
      </div>
    </div>
  )
}

export function BackendDbCard() {
  const [tables, setTables] = useState<Array<{name: string; rows: number}>>([])
  const version = bus.version
  useEffect(() => {
    const timer = setTimeout(() => {
      backendDb.tables().then(setTables, () => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [version])
  const active = deployments.active
  const used = active?.mode !== 'cloud'
  return (
    <div className="stack">
      <div className="row">
        <span className="muted">
          {used
            ? `${backendDb.driver} client`
            : 'not used by the cloud backend'}
        </span>
        <span className="spacer" />
        <span className="muted">{backendDb.statements} statements</span>
      </div>
      <ul className="list">
        {tables
          .filter(table => table.name.startsWith('alinea_'))
          .map(table => (
            <li key={table.name} className="row">
              <span className="db-name">{table.name}</span>
              <span>{table.rows} rows</span>
            </li>
          ))}
      </ul>
    </div>
  )
}

export function CloudCard() {
  const active = deployments.active?.mode === 'cloud'
  return (
    <div className="stack">
      <div className="row">
        <span className={`badge ${active ? 'badge-succeeded' : ''}`}>
          {active ? 'in use' : 'not in use'}
        </span>
        <span className="spacer" />
        <FaultSelect node="cloud" />
      </div>
      <p className="muted">
        tree, blobs and write of the cloud API, committing to git
      </p>
    </div>
  )
}

export function GithubCard() {
  if (!github.commits.length) return <p className="muted">Empty.</p>
  const head = github.head
  const titles = github.files().map(({path}) => {
    const record = JSON.parse(github.read(path) ?? '{}')
    return {path, title: record.title as string}
  })
  return (
    <div className="stack">
      <div className="row">
        <span className="muted">head</span>
        <Sha
          sha={head.contentSha}
          compare={false}
          title="Content sha at the head"
        />
        <span className="muted">config v{head.configVersion}</span>
        <span className="spacer" />
        <FaultSelect node="github" />
      </div>
      <ul className="titles">
        {titles.map(file => (
          <li key={file.path} title={`content/${file.path}`}>
            {file.title}
          </li>
        ))}
      </ul>
      <ul className="list commits">
        {[...github.commits]
          .reverse()
          .slice(0, 9)
          .map(commit => (
            <li key={commit.id}>
              <div className="row">
                <code>{commit.id.slice(0, 7)}</code>
                <Sha sha={commit.contentSha} title="Content sha" />
                <span className="muted ellipsis">{commit.author}</span>
              </div>
              <div className="small-text ellipsis">{commit.message}</div>
            </li>
          ))}
      </ul>
    </div>
  )
}

export function DeveloperCard() {
  const busy = lab.busy
  return (
    <div className="stack">
      <button
        type="button"
        disabled={busy || !github.commits.length}
        onClick={act(() => lab.developerPush('about'))}
      >
        push an edit of About
      </button>
      <button
        type="button"
        disabled={busy || !github.commits.length}
        onClick={act(() =>
          lab.pushConfig(github.head.configVersion === 1 ? 2 : 1)
        )}
      >
        push config v
        {github.commits.length && github.head.configVersion === 1 ? 2 : 1}
      </button>
      <p className="muted">Pushes deploy only when you deploy the head.</p>
    </div>
  )
}

export function ClockCard() {
  const offset = Math.round(clock.offset / 1000)
  const states = [bus.states['isolate-1'], bus.states['isolate-2']]
  const timers = states.flatMap(state => state?.timers ?? []) as Array<{
    inMs: number
    every?: number
  }>
  return (
    <div className="stack">
      <div className="row">
        <span className="clock">
          +{Math.floor(offset / 60)}m {String(offset % 60).padStart(2, '0')}s
        </span>
        <span className="muted">ahead of real time</span>
      </div>
      <div className="row">
        {[10, 61, 121, 300].map(seconds => (
          <button
            key={seconds}
            type="button"
            className="small"
            onClick={() => lab.advance(seconds)}
          >
            +{seconds >= 60 ? `${Math.round(seconds / 60)}m` : `${seconds}s`}
          </button>
        ))}
      </div>
      <p className="muted">
        Dashboards sync every 120s, the cached sha lasts 60s, reads wait 10s for
        a sync.
        {timers.length > 0 && ` Isolates hold ${timers.length} timer(s).`}
      </p>
    </div>
  )
}
