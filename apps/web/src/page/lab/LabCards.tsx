import styler from '@alinea/styler'
import type {
  Fault,
  LabActions,
  LabView,
  RenderView,
  TabView,
  UserView
} from './labEngine'
import {LabButton} from './LabControls'
import {LabSha} from './LabSha'
import css from './LabCards.module.scss'

const styles = styler(css)

export interface LabCardProps {
  view: LabView
  actions: LabActions
}

function Row({children}: {children: React.ReactNode}) {
  return <div className={styles.LabCards.row()}>{children}</div>
}

function Muted({children, title}: {children: React.ReactNode; title?: string}) {
  return (
    <span className={styles.LabCards.muted()} title={title}>
      {children}
    </span>
  )
}

function Status({
  children,
  tone
}: {
  children: React.ReactNode
  tone?: 'positive' | 'negative' | 'active'
}) {
  return <span className={styles.LabCards.status(tone)}>{children}</span>
}

const toneOf = (status: string) =>
  status === 'succeeded'
    ? 'positive'
    : status === 'failed' || status === 'blocked'
      ? 'negative'
      : 'active'

// Users -----------------------------------------------------------------------

export function LabTabCard({view, tab}: {view: LabView; tab: TabView}) {
  const home = tab.entries.find(entry => entry.key === 'home')
  return (
    <div className={styles.LabCards.stack()}>
      <LabSha sha={tab.sha} head={view.head} title="Worker store" compact />
      <span className={styles.LabCards.ellipsis()}>
        {tab.error ? '⚠ error' : (home?.title ?? (tab.ready ? '' : 'loading…'))}
      </span>
      {tab.save && (
        <Status tone={toneOf(tab.save.status)}>save {tab.save.status}</Status>
      )}
    </div>
  )
}

export function LabWorkerCard({view, user}: {view: LabView; user: UserView}) {
  const tab = user.tabs[0]
  const syncing = user.tabs.some(t => t.catchingUp || t.progress)
  const progress = user.tabs.find(t => t.progress)?.progress
  if (!tab) return <Muted>Not running: a tab starts it.</Muted>
  return (
    <div className={styles.LabCards.stack()}>
      <Row>
        <LabSha sha={tab.sha} head={view.head} title="Store of the worker" />
        <Muted title="One shared worker per dashboard build">
          v{tab.configVersion}
        </Muted>
      </Row>
      <Muted>
        {progress
          ? `fetching ${progress.loaded}/${progress.total}`
          : syncing
            ? 'catching up'
            : `${user.tabs.length} tab${user.tabs.length === 1 ? '' : 's'}`}
      </Muted>
    </div>
  )
}

export function LabStorageCard({user}: {user: UserView}) {
  const configs = [...new Set(user.bases.map(base => base.config))]
  return (
    <div className={styles.LabCards.stack()}>
      <span>
        {user.bases.length} base{user.bases.length === 1 ? '' : 's'}
      </span>
      <Muted>{configs.join(', ') || 'empty'}</Muted>
    </div>
  )
}

// Site ------------------------------------------------------------------------

function Rendered({render, view}: {render?: RenderView; view: LabView}) {
  if (!render) return <Muted>Nothing rendered yet.</Muted>
  return (
    <div className={styles.LabCards.stack()}>
      <Row>
        <Muted>λ{render.slot + 1}</Muted>
        <LabSha sha={render.sha} head={view.head} title="Render" />
      </Row>
      {render.error && (
        <span className={styles.LabCards.error()}>{render.error}</span>
      )}
      <ul className={styles.LabCards.list()}>
        {render.titles.map(title => (
          <li key={title} className={styles.LabCards.ellipsis()}>
            {title}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LabVisitorCard({view, actions}: LabCardProps) {
  return (
    <div className={styles.LabCards.stack()}>
      <Row>
        <LabButton
          size="small"
          disabled={view.busy}
          onClick={() => actions.visit()}
        >
          Visit
        </LabButton>
        <LabButton
          size="small"
          variant="quiet"
          disabled={view.busy}
          onClick={() => actions.visit(0)}
        >
          λ1
        </LabButton>
        <LabButton
          size="small"
          variant="quiet"
          disabled={view.busy}
          onClick={() => actions.visit(1)}
        >
          λ2
        </LabButton>
      </Row>
      <Rendered render={view.rendered.visitor} view={view} />
    </div>
  )
}

export function LabPreviewCard({view}: LabCardProps) {
  return view.rendered.preview ? (
    <Rendered render={view.rendered.preview} view={view} />
  ) : (
    <Muted>Select a tab, edit a title and press Preview.</Muted>
  )
}

const faults: Array<[string, Fault | '']> = [
  ['works', ''],
  ['down', 'down'],
  ['hangs', 'hang'],
  ['loses answers', 'drop-response']
]

function FaultSelect({node, view, actions}: LabCardProps & {node: string}) {
  return (
    <select
      className={styles.LabCards.fault()}
      value={view.faults[node] ?? ''}
      title="What this node does with requests"
      onChange={event =>
        actions.setFault(node, (event.target.value || undefined) as Fault)
      }
    >
      {faults.map(([label, value]) => (
        <option key={label} value={value}>
          {label}
        </option>
      ))}
    </select>
  )
}

function ago(view: LabView, at?: number) {
  if (!at) return 'never'
  const seconds = Math.round((Date.now() + view.clockOffset - at) / 1000)
  if (seconds < 2) return 'just now'
  if (seconds < 120) return `${seconds}s ago`
  return `${Math.round(seconds / 60)}m ago`
}

export function LabIsolateCard({
  view,
  actions,
  slot
}: LabCardProps & {slot: number}) {
  const isolate = view.isolates[slot]
  const pinned = view.routing === slot
  return (
    <div className={styles.LabCards.stack()}>
      <Row>
        <Status
          tone={
            isolate.warm ? 'positive' : isolate.running ? 'active' : undefined
          }
        >
          {isolate.warm ? 'warm' : isolate.running ? 'starting' : 'not running'}
        </Status>
        <span className={styles.LabCards.spacer()} />
        <FaultSelect node={isolate.node} view={view} actions={actions} />
      </Row>
      {isolate.stores.map(store => (
        <div key={store.name} className={styles.LabCards.store()}>
          <span className={styles.LabCards.store.label()}>{store.name}</span>
          <LabSha
            sha={store.sha}
            head={view.head}
            title={`${store.name} database`}
          />
          <span className={styles.LabCards.ellipsis()}>{store.home}</span>
        </div>
      ))}
      <Muted>
        changed {ago(view, isolate.changedAt)} · {isolate.queries} queries
      </Muted>
      <Row>
        <LabButton
          size="small"
          variant={pinned ? 'primary' : 'secondary'}
          onClick={() =>
            actions.setRouting(pinned ? 'alternate' : (slot as 0 | 1))
          }
          title="Route every request of the site here"
        >
          {pinned ? 'Pinned' : 'Pin'}
        </LabButton>
        <LabButton
          size="small"
          disabled={!isolate.running}
          onClick={() => actions.stop(slot)}
          title="Stop this instance, as a host does after it idled"
        >
          Stop
        </LabButton>
        <LabButton
          size="small"
          onClick={() => actions.loseNextSave(slot)}
          title="The next save this isolate handles runs, but its answer never arrives"
        >
          Lose save answer
        </LabButton>
      </Row>
    </div>
  )
}

export function LabBuildCard({view, actions}: LabCardProps) {
  return (
    <div className={styles.LabCards.stack()}>
      <Row>
        <LabButton
          size="small"
          disabled={view.busy || !view.head}
          onClick={() => actions.deploy()}
        >
          Deploy head
        </LabButton>
        <select
          className={styles.LabCards.fault()}
          value={String(view.routing)}
          title="How the edge routes requests"
          onChange={event => {
            const value = event.target.value
            actions.setRouting(
              value === 'alternate' ? 'alternate' : (Number(value) as 0 | 1)
            )
          }}
        >
          <option value="alternate">edge alternates</option>
          <option value="0">edge: λ1 only</option>
          <option value="1">edge: λ2 only</option>
        </select>
      </Row>
      <ul className={styles.LabCards.list('divided')}>
        {view.deployments.slice(0, 3).map(d => (
          <li
            key={d.n}
            className={styles.LabCards.deployment({retired: !d.live})}
          >
            <Row>
              <strong>#{d.n}</strong>
              <LabSha sha={d.sha} head={view.head} title="Generated database" />
            </Row>
            <Muted>
              {d.live ? 'live' : 'retired'} · config v{d.configVersion} ·{' '}
              {d.mode}
              {d.mode === 'self-hosted' ? ` · ${d.driver}` : ''} ·{' '}
              {Math.round(d.size / 1024)} KiB
            </Muted>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Services ------------------------------------------------------------------

export function LabCacheCard({view, actions}: LabCardProps) {
  return (
    <div className={styles.LabCards.stack()}>
      {view.cache.length === 0 && <Muted>Empty.</Muted>}
      {view.cache.map(entry => (
        <div key={entry.label} className={styles.LabCards.stack()}>
          <Muted>{entry.label}</Muted>
          <Row>
            <LabSha
              sha={entry.value}
              head={view.head}
              title="Cached content sha"
            />
            <Status tone={entry.stale ? 'negative' : 'positive'}>
              {entry.stale
                ? entry.revalidated
                  ? 'revalidated'
                  : 'expired'
                : `${entry.age}s of ${entry.revalidate}s`}
            </Status>
          </Row>
        </div>
      ))}
      <Row>
        <LabButton
          size="small"
          variant="quiet"
          onClick={() => actions.purgeCache()}
        >
          Purge
        </LabButton>
      </Row>
    </div>
  )
}

export function LabBackendCard({view}: LabCardProps) {
  return (
    <div className={styles.LabCards.stack()}>
      <Muted>
        {view.backend.used
          ? `${view.backend.driver} · ${view.backend.statements} statements`
          : 'not used by the cloud backend'}
      </Muted>
      <ul className={styles.LabCards.list('divided')}>
        {view.backend.tables.map(table => (
          <li key={table.name} className={styles.LabCards.row()}>
            <span className={styles.LabCards.ellipsis()}>
              {table.name.replace('alinea_', '')}
            </span>
            <span className={styles.LabCards.spacer()} />
            <Muted>{table.rows}</Muted>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LabCloudCard({view, actions}: LabCardProps) {
  return (
    <div className={styles.LabCards.stack()}>
      <Row>
        <Status tone={view.cloud.active ? 'positive' : undefined}>
          {view.cloud.active ? 'in use' : 'not in use'}
        </Status>
        <span className={styles.LabCards.spacer()} />
        <FaultSelect node="cloud" view={view} actions={actions} />
      </Row>
      <Muted>Tree, blobs and write, committing to git</Muted>
    </div>
  )
}

export function LabGitCard({view, actions}: LabCardProps) {
  return (
    <div className={styles.LabCards.stack()}>
      <Row>
        <LabSha sha={view.head} title="Head of the branch" />
        <span className={styles.LabCards.spacer()} />
        <FaultSelect node="github" view={view} actions={actions} />
      </Row>
      <Muted>head · config v{view.git.configVersion}</Muted>
      <ul className={styles.LabCards.list()}>
        {view.git.files.map(file => (
          <li
            key={file.path}
            className={styles.LabCards.ellipsis()}
            title={`content/${file.path}`}
          >
            {file.title}
          </li>
        ))}
      </ul>
      <ul className={styles.LabCards.list('divided')}>
        {view.git.commits.slice(0, 7).map(commit => (
          <li key={commit.id}>
            <Row>
              <code className={styles.LabCards.code()}>
                {commit.id.slice(0, 7)}
              </code>
              <LabSha sha={commit.sha} />
            </Row>
            <div className={styles.LabCards.ellipsis()}>{commit.message}</div>
            <Muted>{commit.author}</Muted>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LabDeveloperCard({view, actions}: LabCardProps) {
  const next = view.git.configVersion === 1 ? 2 : 1
  return (
    <div className={styles.LabCards.stack()}>
      <LabButton
        size="small"
        disabled={view.busy || !view.head}
        onClick={() => actions.developerPush()}
      >
        Push an edit of About
      </LabButton>
      <LabButton
        size="small"
        disabled={view.busy || !view.head}
        onClick={() => actions.pushConfig()}
      >
        Push config v{next}
      </LabButton>
      <Muted>Pushes reach the site on the next deploy, or with a sync.</Muted>
    </div>
  )
}
