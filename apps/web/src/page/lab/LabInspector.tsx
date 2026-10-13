import styler from '@alinea/styler'
import {useEffect, useState} from 'react'
import type {
  InspectSection,
  LabEngine,
  LabEvent,
  LabView,
  TabView
} from './labEngine'
import {infoOf} from './labNodes'
import {LabButton} from './LabControls'
import {LabSha} from './LabSha'
import css from './LabInspector.module.scss'

const styles = styler(css)

export interface LabInspectorProps {
  engine: LabEngine
  view: LabView
  node?: string
  event?: LabEvent
}

export function LabInspector({engine, view, node, event}: LabInspectorProps) {
  const info = node ? infoOf(node) : undefined
  const tab = node
    ? view.users.flatMap(user => user.tabs).find(t => t.node === node)
    : undefined
  return (
    <div className={styles.LabInspector()}>
      {event && (
        <section className={styles.LabInspector.section()}>
          <h3 className={styles.LabInspector.title()}>Event</h3>
          <p className={styles.LabInspector.muted()}>
            {event.node}
            {event.part ? ` / ${event.part}` : ''} · {event.kind}
          </p>
          <p>{event.text}</p>
          {event.detail !== undefined && (
            <pre className={styles.LabInspector.code()}>
              {JSON.stringify(event.detail, null, 2)}
            </pre>
          )}
        </section>
      )}
      {!node && (
        <p className={styles.LabInspector.muted()}>
          Select a node on the board to see what it holds and which code runs
          it. Select a tab to edit in it.
        </p>
      )}
      {tab && <TabEditor engine={engine} view={view} tab={tab} />}
      {node && info && (
        <section className={styles.LabInspector.section()}>
          <h3 className={styles.LabInspector.title()}>{info.title}</h3>
          <p>{info.about}</p>
          <p className={styles.LabInspector.muted()}>{info.lab}</p>
          {info.code.length > 0 && (
            <ul className={styles.LabInspector.files()}>
              {info.code.map(file => (
                <li key={file}>
                  <code>{file}</code>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {node && <Details engine={engine} view={view} node={node} />}
      {node && <Recent engine={engine} node={node} />}
    </div>
  )
}

function TabEditor({
  engine,
  view,
  tab
}: {
  engine: LabEngine
  view: LabView
  tab: TabView
}) {
  const {actions} = engine
  const [editing, setEditing] = useState<string>()
  const [value, setValue] = useState('')
  const failed = tab.save?.status === 'failed' || tab.save?.status === 'blocked'
  return (
    <section className={styles.LabInspector.section()}>
      <h3 className={styles.LabInspector.title()}>
        Edit in {tab.label} <LabSha sha={tab.sha} head={view.head} />
      </h3>
      {tab.error && <p className={styles.LabInspector.error()}>{tab.error}</p>}
      <ul className={styles.LabInspector.entries()}>
        {tab.entries.map(entry => (
          <li key={entry.id}>
            {editing === entry.id ? (
              <form
                className={styles.LabInspector.edit()}
                onSubmit={event => {
                  event.preventDefault()
                  setEditing(undefined)
                  void actions.save(tab.id, entry.id, value)
                }}
              >
                <input
                  className={styles.LabInspector.input()}
                  value={value}
                  autoFocus
                  aria-label={`Title of ${entry.key}`}
                  onChange={event => setValue(event.target.value)}
                />
                <LabButton type="submit" size="small" variant="primary">
                  Save
                </LabButton>
                <LabButton
                  size="small"
                  onClick={() => void actions.preview(tab.id, entry.id, value)}
                  title="Render a draft with this title, without saving"
                >
                  Preview
                </LabButton>
                <LabButton
                  size="small"
                  variant="quiet"
                  onClick={() => setEditing(undefined)}
                >
                  Cancel
                </LabButton>
              </form>
            ) : (
              <button
                type="button"
                className={styles.LabInspector.entry()}
                onClick={() => {
                  setEditing(entry.id)
                  setValue(entry.title)
                }}
              >
                <span className={styles.LabInspector.entry.key()}>
                  {entry.key}
                </span>
                <span>{entry.title}</span>
                <span className={styles.LabInspector.entry.edit()}>Edit</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.LabInspector.actions()}>
        <LabButton
          size="small"
          onClick={() => void actions.sync(tab.id)}
          title="The worker syncs every 120s"
        >
          Sync now
        </LabButton>
        {failed && (
          <>
            <LabButton size="small" onClick={() => void actions.retry(tab.id)}>
              Retry save
            </LabButton>
            <LabButton
              size="small"
              onClick={() => void actions.discard(tab.id)}
            >
              Discard
            </LabButton>
          </>
        )}
        <LabButton
          size="small"
          variant="quiet"
          onClick={() => actions.closeTab(tab.id)}
        >
          Close tab
        </LabButton>
      </div>
    </section>
  )
}

function Details({
  engine,
  view,
  node
}: {
  engine: LabEngine
  view: LabView
  node: string
}) {
  const [sections, setSections] = useState<Array<InspectSection>>([])
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      engine.inspect(node).then(
        next => {
          if (!cancelled) setSections(next)
        },
        () => {}
      )
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [engine, node, view])
  return (
    <>
      {sections.map(section => (
        <section key={section.title} className={styles.LabInspector.section()}>
          <h3 className={styles.LabInspector.title()}>{section.title}</h3>
          {section.text && (
            <p className={styles.LabInspector.muted()}>{section.text}</p>
          )}
          {section.table && (
            <div className={styles.LabInspector.scroll()}>
              <table className={styles.LabInspector.table()}>
                <thead>
                  <tr>
                    {section.table.columns.map(column => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, column) => (
                        <td key={column}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {section.code && (
            <pre className={styles.LabInspector.code()}>{section.code}</pre>
          )}
        </section>
      ))}
    </>
  )
}

function Recent({engine, node}: {engine: LabEngine; node: string}) {
  const events = engine
    .events()
    .filter(e => e.node === node)
    .slice(-30)
    .reverse()
  if (events.length === 0) return null
  return (
    <section className={styles.LabInspector.section()}>
      <h3 className={styles.LabInspector.title()}>Recent events</h3>
      <ul className={styles.LabInspector.events()}>
        {events.map(e => (
          <li key={e.id}>{e.text}</li>
        ))}
      </ul>
    </section>
  )
}
