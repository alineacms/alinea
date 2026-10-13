import {useLayoutEffect, useRef, useState} from 'react'
import type {LogEvent} from '../world/bus.js'
import {nodes} from './nodes.js'
import {useBus} from './useBus.js'

interface EventLogProps {
  selected?: LogEvent
  onSelect(event: LogEvent): void
}

const hidden = new Set(['http'])

export function EventLog({selected, onSelect}: EventLogProps) {
  const bus = useBus()
  const [filter, setFilter] = useState('')
  const [node, setNode] = useState('')
  const [hops, setHops] = useState(false)
  const list = useRef<HTMLOListElement>(null)
  const stick = useRef(true)
  useLayoutEffect(() => {
    const element = list.current
    if (element && stick.current) element.scrollTop = element.scrollHeight
  })
  const start = bus.events[0]?.at ?? 0
  const needle = filter.toLowerCase()
  const events = bus.events
    .filter(
      e =>
        (hops || !hidden.has(e.kind)) &&
        (!node || e.node === node) &&
        (!needle ||
          `${e.node} ${e.part ?? ''} ${e.kind} ${e.text}`
            .toLowerCase()
            .includes(needle))
    )
    .slice(-400)
  return (
    <div className="log">
      <div className="log-bar">
        <b>Event log</b>
        <input
          placeholder="filter"
          value={filter}
          onChange={event => setFilter(event.target.value)}
        />
        <select value={node} onChange={event => setNode(event.target.value)}>
          <option value="">every node</option>
          {Object.keys(nodes).map(id => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
          <option value="scenario">scenario</option>
        </select>
        <label>
          <input
            type="checkbox"
            checked={hops}
            onChange={event => setHops(event.target.checked)}
          />{' '}
          every request
        </label>
        <span className="spacer" />
        <span className="muted">{bus.events.length} events</span>
        <button type="button" className="small" onClick={() => bus.clear()}>
          clear
        </button>
      </div>
      <ol
        className="log-list"
        ref={list}
        onScroll={event => {
          const element = event.currentTarget
          // Follow new events while scrolled to the end
          stick.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 40
        }}
      >
        {events.map(e => (
          <li
            key={e.id}
            className={`log-row log-${e.kind} ${selected?.id === e.id ? 'log-selected' : ''}`}
            onClick={() => onSelect(e)}
          >
            <span className="log-time">{formatTime(e.at - start)}</span>
            <span
              className={`log-node log-node-${nodes[e.node]?.kind ?? 'other'}`}
            >
              {e.node}
              {e.part ? `/${e.part}` : ''}
            </span>
            <span className="log-text">{e.text}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function formatTime(ms: number) {
  const seconds = Math.max(0, ms / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
}
