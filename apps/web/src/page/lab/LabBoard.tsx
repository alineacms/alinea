import styler from '@alinea/styler'
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import type {LabEngine, LabPacket, LabView, UserView} from './labEngine'
import {type BoardLayout, boardLayout, type Rect} from './labNodes'
import {
  LabBackendCard,
  LabBuildCard,
  LabCacheCard,
  LabCloudCard,
  LabDeveloperCard,
  LabGitCard,
  LabInstanceCard,
  LabPreviewCard,
  LabStorageCard,
  LabTabCard,
  LabVisitorCard,
  LabWorkerCard
} from './LabCards'
import {LabButton} from './LabControls'
import css from './LabBoard.module.scss'

const styles = styler(css)

export interface LabBoardProps {
  engine: LabEngine
  view: LabView
  selected?: string
  onSelect(node: string): void
}

interface BoardNode {
  id: string
  title: string
  kind: string
  content: ReactNode
}

function boardNodes(engine: LabEngine, view: LabView): Array<BoardNode> {
  const {actions} = engine
  const props = {view, actions}
  const nodes: Array<BoardNode> = []
  for (const user of view.users) {
    for (const tab of user.tabs)
      nodes.push({
        id: tab.node,
        title: tab.label,
        kind: 'tab',
        content: <LabTabCard view={view} tab={tab} />
      })
    nodes.push({
      id: user.worker,
      title: 'Shared worker',
      kind: 'worker',
      content: <LabWorkerCard view={view} user={user} />
    })
    nodes.push({
      id: user.storage,
      title: 'IndexedDB',
      kind: 'storage',
      content: <LabStorageCard user={user} />
    })
  }
  nodes.push(
    {
      id: 'visitor',
      title: 'Visitor',
      kind: 'actor',
      content: <LabVisitorCard {...props} />
    },
    {
      id: 'preview',
      title: 'Draft preview',
      kind: 'actor',
      content: <LabPreviewCard {...props} />
    }
  )
  for (const instance of [...view.handlers, ...view.pages])
    nodes.push({
      id: instance.node,
      title:
        instance.role === 'handler'
          ? `Handler λ${instance.slot + 1} · /api/cms`
          : `Pages λ${instance.slot + 1} · RSC`,
      kind: instance.role,
      content: <LabInstanceCard {...props} instance={instance} />
    })
  nodes.push(
    {
      id: 'build',
      title: 'Build & deploy',
      kind: 'build',
      content: <LabBuildCard {...props} />
    },
    {
      id: 'data-cache',
      title: 'Next data cache',
      kind: 'store',
      content: <LabCacheCard {...props} />
    },
    {
      id: 'backend-db',
      title: 'Backend database',
      kind: 'store',
      content: <LabBackendCard {...props} />
    },
    {
      id: 'cloud',
      title: 'Alinea Cloud',
      kind: 'cloud',
      content: <LabCloudCard {...props} />
    },
    {
      id: 'github',
      title: 'Git · main',
      kind: 'git',
      content: <LabGitCard {...props} />
    },
    {
      id: 'developer',
      title: 'Developer',
      kind: 'actor',
      content: <LabDeveloperCard {...props} />
    }
  )
  return nodes
}

export function LabBoard({engine, view, selected, onSelect}: LabBoardProps) {
  const frame = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const layout = boardLayout(view)
  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      setScale(Math.min(1.2, element.clientWidth / layout.width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [layout.width])
  const now = performance.now()
  return (
    <div
      ref={frame}
      className={styles.LabBoard()}
      style={{height: layout.height * scale}}
    >
      <div
        className={styles.LabBoard.canvas()}
        style={{
          width: layout.width,
          height: layout.height,
          transform: `scale(${scale})`
        }}
      >
        <svg
          className={styles.LabBoard.edges()}
          width={layout.width}
          height={layout.height}
          aria-hidden
        >
          {layout.edges.map(([from, to]) => {
            const [x1, y1] = center(layout, from)
            const [x2, y2] = center(layout, to)
            return (
              <line
                key={`${from}-${to}`}
                className={styles.LabBoard.edge()}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
              />
            )
          })}
        </svg>
        {view.users.map(user => (
          <UserGroup
            key={user.id}
            user={user}
            rect={layout.groups[user.node]}
            engine={engine}
            busy={view.busy}
          />
        ))}
        {boardNodes(engine, view).map(node => {
          const rect = layout.nodes[node.id]
          if (!rect) return null
          const flash = view.flashes[node.id]
          return (
            <section
              key={node.id}
              data-node={node.id}
              className={styles.LabBoard.node(node.kind, {
                selected: selected === node.id,
                lit: flash !== undefined && now - flash < 700
              })}
              style={{left: rect.x, top: rect.y, width: rect.w, height: rect.h}}
              onClick={event => {
                const target = event.target as HTMLElement
                if (target.closest('button, select, input')) return
                onSelect(node.id)
              }}
            >
              <header className={styles.LabBoard.node.title()}>
                {node.title}
              </header>
              <div className={styles.LabBoard.node.body()}>{node.content}</div>
            </section>
          )
        })}
        <Packets engine={engine} layout={layout} />
      </div>
    </div>
  )
}

interface UserGroupProps {
  user: UserView
  rect: Rect
  engine: LabEngine
  busy: boolean
}

function UserGroup({user, rect, engine, busy}: UserGroupProps) {
  const {actions} = engine
  return (
    <div
      className={styles.LabBoard.group()}
      data-user={user.id}
      style={{left: rect.x, top: rect.y, width: rect.w, height: rect.h}}
    >
      <header className={styles.LabBoard.group.header()}>
        <span className={styles.LabBoard.group.avatar()}>{user.name[0]}</span>
        <span className={styles.LabBoard.group.user()}>{user.name}</span>
        <span className={styles.LabBoard.group.spacer()} />
        <LabButton
          size="small"
          disabled={busy}
          onClick={() => actions.openTab(user.id)}
        >
          + Tab
        </LabButton>
        <LabButton
          size="small"
          variant="quiet"
          disabled={busy}
          onClick={() => actions.quit(user.id)}
          title="Close every tab, the shared worker stops"
        >
          Quit
        </LabButton>
        <LabButton
          size="small"
          variant="quiet"
          disabled={busy}
          onClick={() => actions.clearStorage(user.id)}
          title="Delete the IndexedDB of this browser"
        >
          Clear
        </LabButton>
      </header>
      {user.tabs.length === 0 && (
        <p className={styles.LabBoard.group.empty()}>
          No tabs open. A tab starts the shared worker of the deployed
          dashboard.
        </p>
      )}
    </div>
  )
}

function center(layout: BoardLayout, id: string): [number, number] {
  const rect = layout.nodes[id]
  if (!rect) return [0, 0]
  return [rect.x + rect.w / 2, rect.y + rect.h / 2]
}

/** Requests and answers travel the edges while they are in flight. */
function Packets({engine, layout}: {engine: LabEngine; layout: BoardLayout}) {
  const svg = useRef<SVGSVGElement>(null)
  const current = useRef(layout)
  current.current = layout
  useEffect(() => {
    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const element = svg.current
      if (!element) return
      const now = performance.now()
      const markup = engine
        .packets()
        .map(packet => packetMarkup(current.current, packet, now))
        .join('')
      if (element.innerHTML !== markup) element.innerHTML = markup
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [engine])
  return (
    <svg
      ref={svg}
      className={styles.LabBoard.packets()}
      width={layout.width}
      height={layout.height}
      aria-hidden
    />
  )
}

function packetMarkup(layout: BoardLayout, packet: LabPacket, now: number) {
  if (!layout.nodes[packet.from] || !layout.nodes[packet.to]) return ''
  const t = Math.min(
    1,
    Math.max(0, (now - packet.started) / Math.max(1, packet.duration))
  )
  const [x1, y1] = center(layout, packet.from)
  const [x2, y2] = center(layout, packet.to)
  let x: number
  let y: number
  if (packet.from === packet.to) {
    // A call to itself loops out and back
    const angle = t * Math.PI * 2
    x = x1 + 70 + Math.cos(angle + Math.PI) * 56
    y = y1 - 100 + Math.sin(angle + Math.PI) * 26
  } else {
    // Requests bend to one side, answers to the other
    const side = packet.kind === 'response' || packet.kind === 'error' ? -1 : 1
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.hypot(dx, dy) || 1
    const cx = (x1 + x2) / 2 + (-dy / length) * 24 * side
    const cy = (y1 + y2) / 2 + (dx / length) * 24 * side
    const u = 1 - t
    x = u * u * x1 + 2 * u * t * cx + t * t * x2
    y = u * u * y1 + 2 * u * t * cy + t * t * y2
  }
  const label = escapeXml(
    packet.label.length > 28 ? `${packet.label.slice(0, 27)}…` : packet.label
  )
  return `<g class="${styles.LabBoard.packet(packet.kind)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="5"/><text x="9" y="4">${label}</text></g>`
}

function escapeXml(text: string) {
  return text.replace(/[<>&"]/g, char => `&#${char.charCodeAt(0)};`)
}
