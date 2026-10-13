import {useEffect, useState} from 'react'
import {backendDb, type BackendDriver} from '../world/backendDb.js'
import {browsers} from '../world/browsers.js'
import {bus, type LogEvent} from '../world/bus.js'
import {dataCache} from '../world/dataCache.js'
import {deployments, type BackendMode} from '../world/deployments.js'
import {github} from '../world/github.js'
import {lab} from '../world/lab.js'
import {network} from '../world/network.js'
import {runScenario, runs, scenarios} from '../world/scenarios.js'
import {Board} from './Board.js'
import {EventLog} from './EventLog.js'
import {Inspector} from './Inspector.js'
import {runAll, Scenarios} from './Scenarios.js'
import {useBus} from './useBus.js'
import './lab.css'

declare global {
  interface Window {
    lab: unknown
  }
}

// For the console, and for tests driving the page
window.lab = {
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

let started: Promise<void> | undefined

export function App() {
  useBus()
  const [node, setNode] = useState<string>()
  const [event, setEvent] = useState<LogEvent>()
  useEffect(() => {
    if (started) return
    lab.busy = true
    started = lab.reset().finally(() => {
      lab.busy = false
      bus.changed()
    })
  }, [])
  const reset = (options: {mode?: BackendMode; driver?: BackendDriver}) => {
    if (lab.busy) return
    lab.busy = true
    bus.changed()
    void lab.reset(options).finally(() => {
      lab.busy = false
      bus.changed()
    })
  }
  return (
    <div className="app">
      <header className="top">
        <h1>
          Alinea sync lab{' '}
          <span className="muted">· v2-rc1 code, running in this page</span>
        </h1>
        <label>
          backend{' '}
          <select
            value={lab.mode}
            disabled={lab.busy}
            onChange={e => reset({mode: e.target.value as BackendMode})}
          >
            <option value="self-hosted">self-hosted: git + database</option>
            <option value="cloud">Alinea Cloud</option>
          </select>
        </label>
        <label title="The client DatabaseApi uses for the backend database">
          database{' '}
          <select
            value={backendDb.driver}
            disabled={lab.busy || lab.mode === 'cloud'}
            onChange={e => reset({driver: e.target.value as BackendDriver})}
          >
            <option value="libsql">libSQL</option>
            <option value="d1">D1</option>
          </select>
        </label>
        <label title="Time each hop of the network takes">
          hop{' '}
          <input
            type="range"
            min={0}
            max={1200}
            step={50}
            value={network.latency}
            onChange={e => {
              network.latency = Number(e.target.value)
              bus.changed()
            }}
          />{' '}
          <span className="muted">{network.latency}ms</span>
        </label>
        <span className="spacer" />
        <button type="button" disabled={lab.busy} onClick={() => reset({})}>
          reset world
        </button>
        <button type="button" disabled={lab.busy} onClick={() => void runAll()}>
          run every scenario
        </button>
      </header>
      <aside className="left">
        <Scenarios onRun={() => setEvent(undefined)} />
      </aside>
      <main className="center">
        <Legend />
        <Board
          selected={node}
          onSelect={id => {
            setNode(id)
            setEvent(undefined)
          }}
        />
      </main>
      <aside className="right">
        <Inspector node={node} event={event} />
      </aside>
      <footer className="bottom">
        <EventLog
          selected={event}
          onSelect={e => {
            setEvent(e)
            setNode(e.node)
          }}
        />
      </footer>
    </div>
  )
}

function Legend() {
  return (
    <div className="legend">
      <span>
        <span
          className="sha sha-head"
          style={{'--sha': 'hsl(150 65% 40%)'} as React.CSSProperties}
        >
          abc1234
        </span>{' '}
        content sha: the same color is the same content
      </span>
      <span>
        <span
          className="sha sha-behind"
          style={{'--sha': 'hsl(20 65% 48%)'} as React.CSSProperties}
        >
          def5678<b className="sha-flag">≠</b>
        </span>{' '}
        not the head of the branch
      </span>
      <span>
        <i className="dot dot-request" /> request{' '}
        <i className="dot dot-response" /> answer{' '}
        <i className="dot dot-event" /> database or cache call{' '}
        <i className="dot dot-error" /> failure
      </span>
    </div>
  )
}
