import styler from '@alinea/styler'
import {useLayoutEffect, useRef, useState} from 'react'
import type {LabEngine, LabEvent} from './labEngine'
import {LabButton} from './LabControls'
import css from './LabLog.module.scss'

const styles = styler(css)

export interface LabLogProps {
  engine: LabEngine
  selected?: LabEvent
  onSelect(event: LabEvent): void
}

/** Every request between nodes is logged too, shown on request. */
const hops = new Set(['http'])

export function LabLog({engine, selected, onSelect}: LabLogProps) {
  const [filter, setFilter] = useState('')
  const [requests, setRequests] = useState(false)
  const list = useRef<HTMLOListElement>(null)
  const follow = useRef(true)
  const all = engine.events()
  useLayoutEffect(() => {
    const element = list.current
    if (element && follow.current) element.scrollTop = element.scrollHeight
  })
  const start = all[0]?.at ?? 0
  const needle = filter.toLowerCase()
  const events = all
    .filter(
      e =>
        (requests || !hops.has(e.kind)) &&
        (!needle ||
          `${e.node} ${e.part ?? ''} ${e.kind} ${e.text}`
            .toLowerCase()
            .includes(needle))
    )
    .slice(-400)
  return (
    <div className={styles.LabLog()}>
      <div className={styles.LabLog.bar()}>
        <h3 className={styles.LabLog.title()}>Event log</h3>
        <input
          className={styles.LabLog.filter()}
          placeholder="Filter, eg. a node or 'conflict'"
          value={filter}
          onChange={event => setFilter(event.target.value)}
        />
        <label className={styles.LabLog.toggle()}>
          <input
            type="checkbox"
            checked={requests}
            onChange={event => setRequests(event.target.checked)}
          />
          Every request
        </label>
        <span className={styles.LabLog.count()}>{all.length} events</span>
        <LabButton
          size="small"
          variant="quiet"
          onClick={() => engine.actions.clearEvents()}
        >
          Clear
        </LabButton>
      </div>
      <ol
        ref={list}
        className={styles.LabLog.list()}
        onScroll={event => {
          const element = event.currentTarget
          // Follow new events while scrolled to the end
          follow.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 40
        }}
      >
        {events.map(e => (
          <li
            key={e.id}
            className={styles.LabLog.row(e.kind, {
              selected: selected?.id === e.id
            })}
            onClick={() => onSelect(e)}
          >
            <span className={styles.LabLog.row.time()}>
              {formatTime(e.at - start)}
            </span>
            <span className={styles.LabLog.row.node()}>
              {e.node}
              {e.part ? `/${e.part}` : ''}
            </span>
            <span className={styles.LabLog.row.text()}>{e.text}</span>
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
