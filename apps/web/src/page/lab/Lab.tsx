import styler from '@alinea/styler'
import {useState, useSyncExternalStore} from 'react'
import type {BackendDriver, BackendMode, LabEngine, LabEvent} from './labEngine'
import {LabBoard} from './LabBoard'
import {LabButton, LabSelect} from './LabControls'
import {LabInspector} from './LabInspector'
import {LabLog} from './LabLog'
import {LabScenarios} from './LabScenarios'
import css from './Lab.module.scss'

const styles = styler(css)

export interface LabProps {
  engine: LabEngine
}

const jumps = [10, 61, 121, 300]

export function Lab({engine}: LabProps) {
  const view = useSyncExternalStore(engine.subscribe, engine.view, engine.view)
  const {actions} = engine
  const [node, setNode] = useState<string>()
  const [event, setEvent] = useState<LabEvent>()
  const offset = Math.round(view.clockOffset / 1000)
  return (
    <div className={styles.Lab()}>
      <div className={styles.Lab.toolbar()}>
        <LabSelect
          label="Backend"
          value={view.mode}
          disabled={view.busy}
          onChange={e =>
            void actions.reset({mode: e.target.value as BackendMode})
          }
        >
          <option value="self-hosted">Self-hosted: git and a database</option>
          <option value="cloud">Alinea Cloud</option>
        </LabSelect>
        <LabSelect
          label="Database"
          value={view.driver}
          disabled={view.busy || view.mode === 'cloud'}
          title="The client DatabaseApi uses for the backend database"
          onChange={e =>
            void actions.reset({driver: e.target.value as BackendDriver})
          }
        >
          <option value="libsql">libSQL</option>
          <option value="d1">D1</option>
        </LabSelect>
        <label
          className={styles.Lab.toolbar.field()}
          title="Time each hop of the network takes"
        >
          <span>Hop</span>
          <input
            type="range"
            min={0}
            max={1200}
            step={50}
            value={view.latency}
            onChange={e => actions.setLatency(Number(e.target.value))}
          />
          <span className={styles.Lab.toolbar.value()}>{view.latency}ms</span>
        </label>
        <div
          className={styles.Lab.toolbar.field()}
          title="Every realm reads this clock: jump ahead to run interval syncs and expire caches"
        >
          <span>Clock</span>
          <span className={styles.Lab.toolbar.value()}>
            +{Math.floor(offset / 60)}:{String(offset % 60).padStart(2, '0')}
          </span>
          {jumps.map(seconds => (
            <LabButton
              key={seconds}
              size="small"
              onClick={() => actions.advance(seconds)}
            >
              +{seconds >= 60 ? `${Math.round(seconds / 60)}m` : `${seconds}s`}
            </LabButton>
          ))}
        </div>
        <span className={styles.Lab.toolbar.spacer()} />
        <LabButton
          disabled={view.busy || view.users.length >= view.maxUsers}
          onClick={() => actions.addUser()}
        >
          Add user
        </LabButton>
        <LabButton disabled={view.busy} onClick={() => void actions.reset()}>
          Reset
        </LabButton>
        <LabButton
          variant="primary"
          disabled={view.busy}
          onClick={() => void actions.runAll()}
        >
          Run every scenario
        </LabButton>
      </div>
      <div className={styles.Lab.legend()}>
        <span>
          <i className={styles.Lab.legend.dot('sha')} /> Content sha: the same
          color is the same content, a ring marks content that is not at the
          head of the branch
        </span>
        <span>
          <i className={styles.Lab.legend.dot('request')} /> request
        </span>
        <span>
          <i className={styles.Lab.legend.dot('response')} /> answer
        </span>
        <span>
          <i className={styles.Lab.legend.dot('event')} /> database, cache or
          worker call
        </span>
        <span>
          <i className={styles.Lab.legend.dot('error')} /> failure
        </span>
      </div>
      <div className={styles.Lab.grid()}>
        <aside className={styles.Lab.scenarios()}>
          <LabScenarios
            scenarios={view.scenarios}
            busy={view.busy}
            actions={actions}
          />
        </aside>
        <div className={styles.Lab.board()}>
          <LabBoard
            engine={engine}
            view={view}
            selected={node}
            onSelect={id => {
              setNode(id)
              setEvent(undefined)
            }}
          />
        </div>
        <aside className={styles.Lab.inspector()}>
          <LabInspector engine={engine} view={view} node={node} event={event} />
        </aside>
      </div>
      <div className={styles.Lab.log()}>
        <LabLog
          engine={engine}
          selected={event}
          onSelect={e => {
            setEvent(e)
            setNode(e.node)
          }}
        />
      </div>
    </div>
  )
}
