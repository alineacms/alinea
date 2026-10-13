import {useEffect, useState} from 'react'
import {backendDb} from '../world/backendDb.js'
import {browsers} from '../world/browsers.js'
import {bus, type LogEvent} from '../world/bus.js'
import {dataCache} from '../world/dataCache.js'
import {deployments} from '../world/deployments.js'
import {github} from '../world/github.js'
import {lab} from '../world/lab.js'
import {network} from '../world/network.js'
import {nodes} from './nodes.js'
import {Sha} from './Sha.js'
import {useBus} from './useBus.js'

interface InspectorProps {
  node?: string
  event?: LogEvent
}

export function Inspector({node, event}: InspectorProps) {
  useBus()
  const info = node ? nodes[node] : undefined
  return (
    <div className="inspector">
      {event && (
        <section className="panel">
          <h3>Event</h3>
          <p>
            <b>{event.node}</b>
            {event.part ? ` / ${event.part}` : ''} · {event.kind}
          </p>
          <p>{event.text}</p>
          {event.detail !== undefined && (
            <pre>{JSON.stringify(event.detail, null, 2)}</pre>
          )}
        </section>
      )}
      {!info && (
        <p className="muted">
          Select a node on the board to see what it holds and which code runs
          it.
        </p>
      )}
      {info && node && (
        <>
          <section className="panel">
            <h3>{info.title}</h3>
            <p>{info.about}</p>
            <p className="muted">{info.lab}</p>
            {info.code.length > 0 && (
              <ul className="code-list">
                {info.code.map(file => (
                  <li key={file}>
                    <code>{file}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Details node={node} />
          <section className="panel">
            <h3>Recent events</h3>
            <ul className="mini-log">
              {bus.events
                .filter(e => e.node === node)
                .slice(-40)
                .reverse()
                .map(e => (
                  <li key={e.id}>
                    <span className="muted">{e.part ?? e.kind}</span> {e.text}
                  </li>
                ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

function Details({node}: {node: string}) {
  if (node.startsWith('isolate-'))
    return <IsolateDetails slot={Number(node.slice(-1)) - 1} />
  if (node.startsWith('browser-')) return <BrowserDetails id={node.slice(-1)} />
  if (node === 'github') return <GithubDetails />
  if (node === 'backend-db') return <BackendDetails />
  if (node === 'data-cache')
    return (
      <section className="panel">
        <h3>Entries</h3>
        <pre>{JSON.stringify([...dataCache.entries.values()], null, 2)}</pre>
      </section>
    )
  if (node === 'build')
    return (
      <section className="panel">
        <h3>Deployments</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>commit</th>
              <th>content</th>
              <th>fingerprint</th>
              <th>isolates</th>
            </tr>
          </thead>
          <tbody>
            {deployments.list.map(d => (
              <tr key={d.id}>
                <td>{d.n}</td>
                <td>
                  <code>{d.commit.id.slice(0, 7)}</code>
                </td>
                <td>
                  <Sha sha={d.contentSha} />
                </td>
                <td>{d.fingerprint}</td>
                <td>{d.isolates.filter(Boolean).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  if (node === 'visitor' || node === 'preview')
    return (
      <section className="panel">
        <h3>Last render</h3>
        <pre>{JSON.stringify(lab.rendered[node], null, 2)}</pre>
      </section>
    )
  return null
}

interface StoreEntry {
  id: string
  title: string
  status: string
  filePath: string
  fileHash: string
}

function IsolateDetails({slot}: {slot: number}) {
  const realm = deployments.active?.isolates[slot]
  const [data, setData] = useState<{
    entries: Record<string, Array<StoreEntry>>
    shas: Record<string, string>
  }>()
  const version = bus.version
  useEffect(() => {
    if (!realm) return
    const timer = setTimeout(() => {
      network.call<typeof data>(realm, 'inspect').then(setData, () => {})
    }, 400)
    return () => clearTimeout(timer)
  }, [realm, version])
  if (!realm)
    return (
      <p className="panel muted">
        Not running: the next request starts it from the generated database.
      </p>
    )
  return (
    <>
      {Object.entries(data?.entries ?? {}).map(([store, entries]) => (
        <section className="panel" key={store}>
          <h3>
            {store} db <Sha sha={data?.shas[store]} />
          </h3>
          <EntryTable entries={entries} />
        </section>
      ))}
    </>
  )
}

function EntryTable({entries}: {entries: Array<StoreEntry>}) {
  return (
    <table>
      <thead>
        <tr>
          <th>title</th>
          <th>status</th>
          <th>file</th>
          <th>blob</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(entry => (
          <tr key={`${entry.id}-${entry.status}`}>
            <td>{entry.title}</td>
            <td>{entry.status}</td>
            <td>
              <code>{entry.filePath}</code>
            </td>
            <td>
              <code>{entry.fileHash.slice(0, 7)}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BrowserDetails({id}: {id: string}) {
  const browser = browsers.find(b => b.id === id)!
  const state = bus.states[browser.node] ?? {}
  return (
    <>
      <section className="panel">
        <h3>IndexedDB bases</h3>
        <p className="muted">
          Each sync saves the store as a base (or a delta over the last one)
          named after its content sha and config fingerprint. A new store opens
          the newest base of its fingerprint, or of any other config and derives
          it again.
        </p>
        <table>
          <thead>
            <tr>
              <th>key</th>
              <th>config</th>
              <th>size</th>
              <th>over</th>
            </tr>
          </thead>
          <tbody>
            {(state.bases ?? []).map(
              (base: {
                key: string
                branch: string
                size: number
                parent?: string
              }) => (
                <tr key={base.key}>
                  <td>
                    <Sha sha={base.key.slice(0, 40)} />
                  </td>
                  <td>{base.branch}</td>
                  <td>{Math.round(base.size / 1024)} KiB</td>
                  <td>
                    {base.parent ? <code>{base.parent.slice(0, 7)}</code> : '—'}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </section>
      {browser.tabs.map(tab => (
        <section className="panel" key={tab.id}>
          <h3>
            {tab.label} <Sha sha={tab.sha} />
          </h3>
          <p className="muted">Activities of the shared worker</p>
          <pre>{JSON.stringify(tab.activities.slice(0, 6), null, 2)}</pre>
        </section>
      ))}
    </>
  )
}

function GithubDetails() {
  const [file, setFile] = useState<string>()
  if (!github.commits.length) return null
  return (
    <>
      <section className="panel">
        <h3>Files at the head</h3>
        <ul className="code-list">
          {github.files().map(f => (
            <li key={f.path}>
              <button
                type="button"
                className="link"
                onClick={() => setFile(f.path)}
              >
                content/{f.path}
              </button>{' '}
              <code className="muted">{f.sha.slice(0, 7)}</code>
            </li>
          ))}
        </ul>
        {file && <pre>{github.read(file)}</pre>}
      </section>
      <section className="panel">
        <h3>History</h3>
        <table>
          <thead>
            <tr>
              <th>commit</th>
              <th>content</th>
              <th>author</th>
              <th>message</th>
            </tr>
          </thead>
          <tbody>
            {[...github.commits].reverse().map(commit => (
              <tr key={commit.id}>
                <td>
                  <code>{commit.id.slice(0, 7)}</code>
                </td>
                <td>
                  <Sha sha={commit.contentSha} />
                </td>
                <td>{commit.author}</td>
                <td>{commit.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}

function BackendDetails() {
  const [blobs, setBlobs] = useState<
    Array<{sha: string; size: number; usedAt: number}>
  >([])
  const version = bus.version
  useEffect(() => {
    const timer = setTimeout(() => backendDb.blobs().then(setBlobs), 300)
    return () => clearTimeout(timer)
  }, [version])
  return (
    <section className="panel">
      <h3>alinea_blob</h3>
      <p className="muted">
        Content blobs any instance fetched from git or committed: instances that
        are behind read them here.
      </p>
      <table>
        <thead>
          <tr>
            <th>sha</th>
            <th>size</th>
            <th>used</th>
          </tr>
        </thead>
        <tbody>
          {blobs.map(blob => (
            <tr key={blob.sha}>
              <td>
                <code>{blob.sha.slice(0, 10)}</code>
              </td>
              <td>{blob.size} B</td>
              <td>{new Date(blob.usedAt * 1000).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
