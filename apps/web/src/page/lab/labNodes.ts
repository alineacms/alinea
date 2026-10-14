import type {LabView} from './labEngine'

export type NodeKind =
  | 'tab'
  | 'worker'
  | 'storage'
  | 'handler'
  | 'pages'
  | 'store'
  | 'git'
  | 'cloud'
  | 'actor'
  | 'build'

export interface NodeInfo {
  title: string
  /** What it is in production. */
  about: string
  /** How the lab hosts it. */
  lab: string
  /** The code that runs it. */
  code: Array<string>
}

/** What each kind of node on the board stands for. */
export const nodeInfo: Record<string, NodeInfo> = {
  tab: {
    title: 'Dashboard tab',
    about:
      'A tab of the dashboard. It renders from the shared worker of its browser: reads and saves go to the worker, which notifies every tab when its content changed.',
    lab: 'Talks to the real shared worker over Comlink through WorkerDB, as the dashboard does.',
    code: ['src/dashboard/boot/Boot.tsx', 'src/dashboard/boot/WorkerDB.ts']
  },
  worker: {
    title: 'Shared worker',
    about:
      'Every dashboard tab of one build connects to one shared worker. It keeps the content in WASM SQLite, applies edits to it first and sends them to the handler in the background, and syncs every 120 seconds.',
    lab: 'A real SharedWorker per user and dashboard build.',
    code: [
      'src/dashboard/boot/LoadWorker.ts',
      'src/dashboard/boot/DashboardWorker.ts',
      'src/database/BrowserEntryStore.ts',
      'src/core/Client.ts'
    ]
  },
  storage: {
    title: 'IndexedDB',
    about:
      'Each sync of the worker saves its store as a base, or as a delta over the last one. A worker that starts opens the newest base and shows it right away, also one of another config, which it derives again.',
    lab: 'Real IndexedDB, with the names of each user prefixed so users keep separate storage.',
    code: ['src/database/BrowserEntryStore.ts']
  },
  visitor: {
    title: 'Visitor',
    about:
      'A request for a page of the site. Server renders query the CMS, which answers from the bundled database once it is at the latest content sha (syncIfStale).',
    lab: 'Rendered by an instance of the pages: NextCMS.find on its copy of the generated database.',
    code: ['src/adapter/next/cms.tsx', 'src/adapter/next/syncCheck.ts']
  },
  preview: {
    title: 'Draft preview',
    about:
      'The preview pane of the dashboard: a draft render with the unsaved edit in a cookie, as a patch against the content the dashboard has. The render applies it on a fork of the database.',
    lab: 'The payload is built from the tab as the entry editor does.',
    code: [
      'src/preview/PreviewPayload.ts',
      'src/backend/resolver/ParsePreview.ts',
      'src/database/EntryStore.ts'
    ]
  },
  handler: {
    title: 'Handler · /api/cms',
    about:
      'The route handler of the site, eg. /api/cms. The dashboard reads and commits through it, and the pages ask it for the latest content. It keeps its own in-memory copy of the generated database, synced with git (or the cloud) before it answers.',
    lab: 'A Web Worker per instance running createHandlerWithDatabase, as alinea/next sets it up. The generated database is read into WASM memory, as runtimeDatabase does where the native overlay is missing.',
    code: [
      'src/adapter/next/handler.ts',
      'src/backend/Handler.ts',
      'src/backend/store/GeneratedDatabase.ts',
      'src/database/EntryStore.ts'
    ]
  },
  pages: {
    title: 'Pages · RSC',
    about:
      "The site's server rendered pages (React Server Components). Their CMS answers queries from its own copy of the generated database, after it checks the content sha in the data cache and syncs through the handler when it is behind.",
    lab: 'A Web Worker per instance running NextCMS, as alinea/next sets it up, with next/cache and next/headers replaced by the lab.',
    code: [
      'src/adapter/next/cms.tsx',
      'src/adapter/next/syncCheck.ts',
      'src/backend/store/GeneratedDatabase.ts'
    ]
  },
  build: {
    title: 'Build & deploy',
    about:
      'A deploy builds a commit and generates the SQLite database of its content, which ships with the deployment. Every handler and page instance starts from it.',
    lab: 'Builds in the page: an entry store synced from the commit, exported as the database file.',
    code: ['src/cli/Generate.ts', 'src/database/EntryDatabase.ts']
  },
  'data-cache': {
    title: 'Next data cache',
    about:
      "The host's data cache, shared by every instance. Alinea keeps the latest content sha in it for syncInterval seconds (60 here) under a tag that commits through the handler revalidate. Stale entries answer once more while they refresh.",
    lab: 'next/cache is replaced by a cache on the page, with stale-while-revalidate.',
    code: ['src/adapter/next/syncCheck.ts']
  },
  'backend-db': {
    title: 'Backend database',
    about:
      'The database of a self-hosted backend. DatabaseApi keeps users, uploads and the content blobs any instance fetched or committed, so instances that are behind read them here instead of asking git again.',
    lab: 'WASM SQLite on the page, which handler instances reach through a libSQL or D1 client.',
    code: [
      'src/backend/api/DatabaseApi.ts',
      'src/backend/api/BlobStore.ts',
      'src/backend/api/CreateBackend.ts'
    ]
  },
  cloud: {
    title: 'Alinea Cloud',
    about:
      'With the cloud backend the handler reads trees and blobs from, and commits through, the cloud API, which commits to the repository.',
    lab: 'The tree, blobs and write endpoints answer as the cloud does, over the lab repository.',
    code: ['src/cloud/CloudRemote.ts']
  },
  github: {
    title: 'Git repository',
    about:
      'The source of truth. Every database records the content sha it is at: the git tree of the content directory.',
    lab: 'A branch of commits on the page. Self-hosted handlers reach it through a client with the contract of GithubApi.',
    code: ['src/backend/api/GithubApi.ts', 'src/core/source/GithubSource.ts']
  },
  developer: {
    title: 'Developer',
    about:
      'Pushes to the repository without the CMS: content files, or code that changes the config.',
    lab: 'Commits straight to the branch.',
    code: []
  }
}

/** The description of a node, by its id. */
export function infoOf(node: string): NodeInfo | undefined {
  if (node.includes('/tab-')) return nodeInfo.tab
  if (node.endsWith('/worker')) return nodeInfo.worker
  if (node.endsWith('/idb')) return nodeInfo.storage
  if (node.startsWith('handler-')) return nodeInfo.handler
  if (node.startsWith('pages-')) return nodeInfo.pages
  return nodeInfo[node]
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface BoardLayout {
  width: number
  height: number
  nodes: Record<string, Rect>
  /** The outline around each user's tabs, worker and storage */
  groups: Record<string, Rect>
  edges: Array<[string, string]>
}

const tab = {w: 104, h: 76, gap: 8}
const groupWidth = 340
const columns = {services: 384, stores: 676, git: 912}
export const boardWidth = 1124

/** Where every node sits: users stack on the left, with their tabs. */
export function boardLayout(view: LabView): BoardLayout {
  const nodes: Record<string, Rect> = {}
  const groups: Record<string, Rect> = {}
  const edges: Array<[string, string]> = []
  let y = 0
  for (const user of view.users) {
    const top = y
    const rows = Math.max(1, Math.ceil(user.tabs.length / 3))
    let tabY = top + 40
    user.tabs.forEach((t, index) => {
      const row = Math.floor(index / 3)
      const column = index % 3
      nodes[t.node] = {
        x: 12 + column * (tab.w + tab.gap),
        y: tabY + row * (tab.h + tab.gap),
        w: tab.w,
        h: tab.h
      }
      edges.push([t.node, user.worker])
    })
    tabY += rows * (tab.h + tab.gap) + 14
    nodes[user.worker] = {x: 12, y: tabY, w: 196, h: 76}
    nodes[user.storage] = {x: 220, y: tabY, w: 108, h: 76}
    edges.push([user.worker, user.storage])
    edges.push([user.worker, 'handler-1'], [user.worker, 'handler-2'])
    y = tabY + 76 + 12
    groups[user.node] = {x: 0, y: top, w: groupWidth, h: y - top}
    y += 16
  }
  nodes.visitor = {x: 0, y, w: 166, h: 132}
  nodes.preview = {x: 174, y, w: 166, h: 132}
  const left = y + 132
  edges.push(
    ['visitor', 'pages-1'],
    ['visitor', 'pages-2'],
    ['preview', 'pages-1'],
    ['preview', 'pages-2']
  )
  const services = columns.services
  // Handlers near the dashboards that call them, pages near the visitors
  nodes['handler-1'] = {x: services, y: 0, w: 252, h: 150}
  nodes['handler-2'] = {x: services, y: 162, w: 252, h: 150}
  nodes['pages-1'] = {x: services, y: 344, w: 252, h: 150}
  nodes['pages-2'] = {x: services, y: 506, w: 252, h: 150}
  const stores = columns.stores
  nodes['data-cache'] = {x: stores, y: 0, w: 204, h: 150}
  nodes['backend-db'] = {x: stores, y: 166, w: 204, h: 196}
  nodes.cloud = {x: stores, y: 378, w: 204, h: 112}
  const git = columns.git
  nodes.github = {x: git, y: 0, w: 212, h: 384}
  nodes.build = {x: git, y: 400, w: 212, h: 256}
  nodes.developer = {x: stores, y: 506, w: 204, h: 150}
  edges.push(
    ['pages-1', 'handler-1'],
    ['pages-1', 'handler-2'],
    ['pages-2', 'handler-1'],
    ['pages-2', 'handler-2'],
    ['pages-1', 'data-cache'],
    ['pages-2', 'data-cache'],
    ['handler-1', 'data-cache'],
    ['handler-2', 'data-cache'],
    ['handler-1', 'backend-db'],
    ['handler-2', 'backend-db'],
    ['handler-1', 'cloud'],
    ['handler-2', 'cloud'],
    ['handler-1', 'github'],
    ['handler-2', 'github'],
    ['cloud', 'github'],
    ['github', 'build'],
    ['developer', 'github']
  )
  return {
    width: boardWidth,
    height: Math.max(left, 656),
    nodes,
    groups,
    edges
  }
}
