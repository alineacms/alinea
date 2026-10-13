/** Where each node sits on the board, and what it stands for. */

export interface NodeInfo {
  title: string
  kind: 'browser' | 'isolate' | 'store' | 'git' | 'cloud' | 'actor' | 'build'
  x: number
  y: number
  w: number
  h: number
  /** What it is in production. */
  about: string
  /** The code that runs it here. */
  code: Array<string>
  /** How the lab hosts it. */
  lab: string
}

export const boardWidth = 1180
export const boardHeight = 760

export const nodes: Record<string, NodeInfo> = {
  'browser-a': {
    title: 'Browser A · ada',
    kind: 'browser',
    x: 16,
    y: 16,
    w: 300,
    h: 330,
    about:
      "An editor's browser. Every dashboard tab of one build connects to one shared worker, which keeps the content in WASM SQLite on top of bases stored in IndexedDB. Edits apply to that store first and are sent to the handler in the background.",
    code: [
      'src/dashboard/boot/LoadWorker.ts',
      'src/dashboard/boot/DashboardWorker.ts',
      'src/dashboard/boot/WorkerDB.ts',
      'src/database/BrowserEntryStore.ts',
      'src/core/Client.ts'
    ],
    lab: 'A real SharedWorker per dashboard build. IndexedDB names are prefixed per browser so two browsers keep separate storage.'
  },
  'browser-b': {
    title: 'Browser B · grace',
    kind: 'browser',
    x: 16,
    y: 362,
    w: 300,
    h: 236,
    about:
      'A second editor on another machine: own shared worker, own IndexedDB.',
    code: [
      'src/dashboard/boot/DashboardWorker.ts',
      'src/database/BrowserEntryStore.ts'
    ],
    lab: 'A real SharedWorker, with its IndexedDB names prefixed.'
  },
  visitor: {
    title: 'Visitor',
    kind: 'actor',
    x: 16,
    y: 614,
    w: 146,
    h: 130,
    about:
      'A request for a page of the site. Server renders query the CMS, which answers from the bundled database after making sure it is at the latest content sha (syncIfStale).',
    code: ['src/adapter/next/cms.tsx', 'src/adapter/next/syncCheck.ts'],
    lab: 'Rendered in an isolate: NextCMS.find on the cms copy of the generated database.'
  },
  preview: {
    title: 'Draft preview',
    kind: 'actor',
    x: 170,
    y: 614,
    w: 146,
    h: 130,
    about:
      'The preview pane of the dashboard: a draft-mode render with the unsaved edit in a cookie, as a patch against the content the dashboard has.',
    code: [
      'src/preview/PreviewPayload.ts',
      'src/backend/resolver/ParsePreview.ts',
      'src/database/EntryStore.ts (resolvePreview)'
    ],
    lab: 'The payload is built from the tab exactly as the entry editor does, and sent as the preview cookie.'
  },
  'isolate-1': {
    title: 'Isolate λ1',
    kind: 'isolate',
    x: 372,
    y: 16,
    w: 250,
    h: 214,
    about:
      'A serverless function instance of the deployment. The route handler and the CMS of server renders each open their own in-memory copy of the generated database, and sync it with the remote on their own.',
    code: [
      'src/adapter/next/handler.ts',
      'src/backend/Handler.ts',
      'src/adapter/next/cms.tsx',
      'src/backend/store/GeneratedDatabase.ts',
      'src/database/EntryStore.ts'
    ],
    lab: 'A dedicated Worker running createHandlerWithDatabase and NextCMS. The generated database is read into WASM memory: the fallback runtimeDatabase uses when the native overlay VFS is missing.'
  },
  'isolate-2': {
    title: 'Isolate λ2',
    kind: 'isolate',
    x: 372,
    y: 246,
    w: 250,
    h: 214,
    about:
      'Another instance of the same deployment, with its own copies of the generated database.',
    code: ['src/backend/Handler.ts', 'src/adapter/next/cms.tsx'],
    lab: 'A dedicated Worker, like λ1. The edge alternates between them unless routing is pinned.'
  },
  build: {
    title: 'Build & deploy',
    kind: 'build',
    x: 372,
    y: 476,
    w: 250,
    h: 268,
    about:
      'A deploy builds a commit: it generates the SQLite database of the content, which ships with the deployment. Every isolate starts from it.',
    code: ['src/cli/Generate.ts', 'src/database/EntryDatabase.ts'],
    lab: 'Builds in the page: an EntryStore synced from the commit, exported as the database file.'
  },
  'data-cache': {
    title: 'Next data cache',
    kind: 'store',
    x: 668,
    y: 16,
    w: 230,
    h: 170,
    about:
      "The host's data cache, shared by every isolate. Alinea keeps the latest content sha in it for syncInterval seconds (60 here), tagged alinea-content-sha; a commit through the handler revalidates the tag. Stale entries answer once more while they refresh.",
    code: ['src/adapter/next/syncCheck.ts'],
    lab: 'next/cache is a shim that keeps entries on the page, with stale-while-revalidate.'
  },
  'backend-db': {
    title: 'Backend database',
    kind: 'store',
    x: 668,
    y: 202,
    w: 230,
    h: 200,
    about:
      'The database of a self-hosted backend (Postgres, MySQL, libSQL, D1, ...). DatabaseApi keeps users, uploads and the content blobs any instance fetched or committed, so instances behind read them here instead of asking git again.',
    code: [
      'src/backend/api/DatabaseApi.ts',
      'src/backend/api/BlobStore.ts',
      'src/backend/api/CreateBackend.ts'
    ],
    lab: 'WASM SQLite on the page, which isolates reach through a libSQL or D1 client.'
  },
  cloud: {
    title: 'Alinea Cloud',
    kind: 'cloud',
    x: 668,
    y: 418,
    w: 230,
    h: 130,
    about:
      'With the cloud backend the handler reads trees and blobs from, and commits through, the cloud API, which commits to the repository.',
    code: ['src/cloud/CloudRemote.ts'],
    lab: 'The tree, blobs and write endpoints answer in the shapes of the cloud API, over the lab repository.'
  },
  github: {
    title: 'Git · main',
    kind: 'git',
    x: 944,
    y: 16,
    w: 220,
    h: 532,
    about:
      'The repository: the source of truth. Every database records the content sha (the git tree of the content directory) it is at.',
    code: ['src/backend/api/GithubApi.ts', 'src/core/source/GithubSource.ts'],
    lab: 'A branch of commits on the page. Self-hosted isolates reach it through LabGithub, which keeps the GithubApi contract (tree per sha, blobs, a commit that fails when the branch moved).'
  },
  developer: {
    title: 'Developer',
    kind: 'actor',
    x: 944,
    y: 564,
    w: 220,
    h: 180,
    about:
      'Pushes to the repository without the CMS: content files, or code that changes the config.',
    code: [],
    lab: 'Commits straight to the branch.'
  },
  clock: {
    title: 'Clock',
    kind: 'actor',
    x: 668,
    y: 564,
    w: 230,
    h: 180,
    about:
      'Every realm reads the lab clock. Timers of 2s and more follow it, so jumping ahead runs the interval sync of dashboards, expires the cached sha and gives up on hung reads.',
    code: [],
    lab: 'Date.now and long timers are patched in every worker.'
  }
}

export const edges: Array<[string, string]> = [
  ['browser-a', 'isolate-1'],
  ['browser-a', 'isolate-2'],
  ['browser-b', 'isolate-1'],
  ['browser-b', 'isolate-2'],
  ['visitor', 'isolate-1'],
  ['visitor', 'isolate-2'],
  ['preview', 'isolate-1'],
  ['preview', 'isolate-2'],
  ['isolate-1', 'isolate-2'],
  ['isolate-1', 'data-cache'],
  ['isolate-2', 'data-cache'],
  ['isolate-1', 'backend-db'],
  ['isolate-2', 'backend-db'],
  ['isolate-1', 'cloud'],
  ['isolate-2', 'cloud'],
  ['isolate-1', 'github'],
  ['isolate-2', 'github'],
  ['cloud', 'github'],
  ['github', 'build'],
  ['build', 'isolate-1'],
  ['build', 'isolate-2'],
  ['developer', 'github']
]
