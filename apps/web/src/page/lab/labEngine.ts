/**
 * What the sync lab page reads from and asks of the lab engine. The engine
 * (`test/lab`) runs Alinea's sync code in workers and is built separately,
 * see `bun lab:build`; the page only knows this contract.
 */

export type BackendMode = 'self-hosted' | 'cloud'
export type BackendDriver = 'libsql' | 'd1'
export type Fault = 'down' | 'hang' | 'drop-response'
export type Routing = 'alternate' | 0 | 1
export type CheckKind = 'pass' | 'fail' | 'info' | 'finding'

export interface LabEngine {
  /** Called whenever the view may have changed. */
  subscribe(listener: () => void): () => void
  view(): LabView
  /** Packets in flight, read on every animation frame. */
  packets(): Array<LabPacket>
  events(): Array<LabEvent>
  /** Details of a node for the inspector. */
  inspect(node: string): Promise<Array<InspectSection>>
  actions: LabActions
}

export interface LabActions {
  reset(options?: {mode?: BackendMode; driver?: BackendDriver}): Promise<void>
  runScenario(id: string): Promise<void>
  runAll(): Promise<void>
  addUser(): void
  openTab(user: string): Promise<void>
  closeTab(tab: number): void
  quit(user: string): void
  clearStorage(user: string): Promise<void>
  save(tab: number, entry: string, title: string): Promise<void>
  preview(tab: number, entry: string, title: string): Promise<void>
  sync(tab: number): Promise<void>
  retry(tab: number): Promise<void>
  discard(tab: number): Promise<void>
  visit(slot?: number): Promise<void>
  developerPush(): Promise<void>
  pushConfig(): Promise<void>
  deploy(): Promise<void>
  stop(slot: number): void
  loseNextSave(slot: number): void
  setRouting(routing: Routing): void
  setFault(node: string, fault: Fault | undefined): void
  advance(seconds: number): void
  setLatency(ms: number): void
  purgeCache(): void
  clearEvents(): void
}

export interface LabView {
  busy: boolean
  mode: BackendMode
  driver: BackendDriver
  latency: number
  /** How far the lab clock runs ahead of real time, in ms. */
  clockOffset: number
  /** The content sha at the head of the branch. */
  head?: string
  users: Array<UserView>
  maxUsers: number
  isolates: Array<IsolateView>
  routing: Routing
  deployments: Array<DeploymentView>
  git: GitView
  cache: Array<CacheEntryView>
  backend: BackendView
  cloud: {active: boolean}
  rendered: {visitor?: RenderView; preview?: RenderView}
  faults: Record<string, Fault | undefined>
  /** When a node last changed, in performance.now() time. */
  flashes: Record<string, number>
  scenarios: Array<ScenarioView>
}

export interface UserView {
  id: string
  name: string
  node: string
  worker: string
  storage: string
  /** Bases of the browser store in IndexedDB, newest first. */
  bases: Array<BaseView>
  tabs: Array<TabView>
}

export interface BaseView {
  key: string
  config: string
  size: number
  parent?: string
}

export interface TabView {
  id: number
  label: string
  node: string
  build: string
  configVersion: number
  ready: boolean
  /** Content sha of the shared worker's store, as the tab last read it. */
  sha?: string
  entries: Array<{id: string; key: string; title: string; status: string}>
  /** The latest save of the worker. */
  save?: {status: string; error?: string}
  catchingUp: boolean
  progress?: {loaded: number; total: number}
  error?: string
}

export interface IsolateView {
  slot: number
  node: string
  running: boolean
  warm: boolean
  deployment?: number
  /** The handler's and the cms's copy of the generated database. */
  stores: Array<{name: string; sha?: string; home?: string}>
  changedAt?: number
  queries: number
}

export interface DeploymentView {
  n: number
  live: boolean
  commit: string
  configVersion: number
  mode: BackendMode
  driver: BackendDriver
  sha: string
  size: number
}

export interface GitView {
  configVersion: number
  files: Array<{path: string; title: string}>
  commits: Array<{id: string; sha: string; author: string; message: string}>
}

export interface CacheEntryView {
  label: string
  value: string
  stale: boolean
  revalidated: boolean
  age: number
  revalidate: number | false
}

export interface BackendView {
  used: boolean
  driver: BackendDriver
  statements: number
  tables: Array<{name: string; rows: number}>
}

export interface RenderView {
  slot: number
  sha?: string
  ms: number
  titles: Array<string>
  error?: string
}

export interface ScenarioView {
  id: string
  group: string
  title: string
  summary: string
  run?: {
    status: 'running' | 'done' | 'error'
    step?: string
    checks: Array<{label: string; kind: CheckKind; detail?: string}>
  }
}

export interface LabPacket {
  id: number
  from: string
  to: string
  label: string
  duration: number
  started: number
  kind: 'request' | 'response' | 'error' | 'event'
}

export interface LabEvent {
  id: number
  at: number
  node: string
  part?: string
  kind: string
  text: string
  detail?: unknown
}

export interface InspectSection {
  title: string
  text?: string
  table?: {columns: Array<string>; rows: Array<Array<string>>}
  code?: string
}
