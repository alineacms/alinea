import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {bus, type Packet} from '../world/bus.js'
import {boardHeight, boardWidth, edges, nodes} from './nodes.js'
import {
  BackendDbCard,
  BrowserCard,
  BuildCard,
  CacheCard,
  ClockCard,
  CloudCard,
  DeveloperCard,
  GithubCard,
  IsolateCard,
  PreviewCard,
  VisitorCard
} from './Cards.js'
import {useBus} from './useBus.js'

interface BoardProps {
  selected?: string
  onSelect(node: string): void
}

const cards: Record<string, () => React.ReactNode> = {
  'browser-a': () => <BrowserCard id="a" />,
  'browser-b': () => <BrowserCard id="b" />,
  visitor: () => <VisitorCard />,
  preview: () => <PreviewCard />,
  'isolate-1': () => <IsolateCard slot={0} />,
  'isolate-2': () => <IsolateCard slot={1} />,
  build: () => <BuildCard />,
  'data-cache': () => <CacheCard />,
  'backend-db': () => <BackendDbCard />,
  cloud: () => <CloudCard />,
  github: () => <GithubCard />,
  developer: () => <DeveloperCard />,
  clock: () => <ClockCard />
}

export function Board({selected, onSelect}: BoardProps) {
  useBus()
  const frame = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const element = frame.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      setScale(Math.min(1.25, element.clientWidth / boardWidth))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const now = performance.now()
  return (
    <div
      className="board-frame"
      ref={frame}
      style={{height: boardHeight * scale}}
    >
      <div
        className="board"
        style={{
          width: boardWidth,
          height: boardHeight,
          transform: `scale(${scale})`
        }}
      >
        <svg className="edges" width={boardWidth} height={boardHeight}>
          {edges.map(([from, to]) => {
            const [x1, y1] = center(from)
            const [x2, y2] = center(to)
            const active = bus.packets.some(
              p =>
                (p.from === from && p.to === to) ||
                (p.from === to && p.to === from)
            )
            return (
              <line
                key={`${from}-${to}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={active ? 'edge edge-active' : 'edge'}
              />
            )
          })}
        </svg>
        {Object.entries(nodes).map(([id, node]) => {
          const flash = bus.flashes[id]
          const lit = flash !== undefined && now - flash < 600
          return (
            <section
              key={id}
              className={`node node-${node.kind} ${selected === id ? 'node-selected' : ''} ${lit ? 'node-lit' : ''}`}
              style={{left: node.x, top: node.y, width: node.w, height: node.h}}
              data-node={id}
              onClick={event => {
                if (
                  (event.target as HTMLElement).closest(
                    'button, input, select, label'
                  )
                )
                  return
                onSelect(id)
              }}
            >
              <header className="node-title">
                <span>{node.title}</span>
                <button
                  type="button"
                  className="node-inspect"
                  onClick={() => onSelect(id)}
                  title="Inspect"
                >
                  ⓘ
                </button>
              </header>
              <div className="node-body">{cards[id]?.()}</div>
            </section>
          )
        })}
        <Packets />
      </div>
    </div>
  )
}

function center(id: string): [number, number] {
  const node = nodes[id]
  if (!node) return [0, 0]
  return [node.x + node.w / 2, node.y + node.h / 2]
}

/** Requests and answers travel the edges while they are in flight. */
function Packets() {
  const svg = useRef<SVGSVGElement>(null)
  useEffect(() => {
    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const element = svg.current
      if (!element) return
      const now = performance.now()
      const markup = bus.packets
        .map(packet => packetMarkup(packet, now))
        .join('')
      if (element.innerHTML !== markup) element.innerHTML = markup
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <svg
      className="packets"
      ref={svg}
      width={boardWidth}
      height={boardHeight}
    />
  )
}

function packetMarkup(packet: Packet, now: number) {
  if (!nodes[packet.from] || !nodes[packet.to]) return ''
  const t = Math.min(
    1,
    Math.max(0, (now - packet.started) / Math.max(1, packet.duration))
  )
  const [x1, y1] = center(packet.from)
  const [x2, y2] = center(packet.to)
  let x: number
  let y: number
  if (packet.from === packet.to) {
    // A call to itself loops out and back
    const angle = t * Math.PI * 2
    x = x1 + 60 + Math.cos(angle + Math.PI) * 50
    y = y1 - 90 + Math.sin(angle + Math.PI) * 30
  } else {
    // Requests bend to one side, answers to the other
    const side = packet.kind === 'response' || packet.kind === 'error' ? -1 : 1
    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.hypot(dx, dy) || 1
    const cx = (x1 + x2) / 2 + (-dy / length) * 26 * side
    const cy = (y1 + y2) / 2 + (dx / length) * 26 * side
    const u = 1 - t
    x = u * u * x1 + 2 * u * t * cx + t * t * x2
    y = u * u * y1 + 2 * u * t * cy + t * t * y2
  }
  const label = escapeXml(
    packet.label.length > 28 ? `${packet.label.slice(0, 27)}…` : packet.label
  )
  return `<g class="packet packet-${packet.kind}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="6"/><text x="9" y="4">${label}</text></g>`
}

function escapeXml(text: string) {
  return text.replace(/[<>&"]/g, char => `&#${char.charCodeAt(0)};`)
}
