import {AuthResultType} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import type {UploadProgress} from '#/core/db/Operation.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {Entry} from '#/core/Entry.js'
import {Field} from '#/core/Field.js'
import {MediaLibrary} from '#/core/media/MediaTypes.js'
import type {PreviewMetadata} from '#/core/Preview.js'
import {Permission, Policy} from '#/core/Role.js'
import {Type} from '#/core/Type.js'
import {localUser, type User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {entries} from '#/core/util/Objects.js'
import {slugify} from '#/core/util/Slugs.js'
import {parents, translations} from '#/query.js'
import type {Atom, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {atomWithStorage, unwrap} from 'jotai/utils'
import {SetStateAction, type ComponentType} from 'react'
import type {Key} from 'react-aria-components'
import {
  MutationQueueEvent,
  type MutationQueueEntry
} from '../boot/MutationQueueEvent.js'
import {createType} from './Editor.js'
import {
  createEntry,
  type DashboardEntryData
} from './Entry.js'
import {
  createExplorer,
  type Explorer,
  type ExplorerLocation,
  type ExplorerOptions
} from './Explorer.js'
import {loadEntrySidebar} from './loaders/Entry.js'
import {createRouteLoader, type LoadedRoute} from './loaders/Route.js'
import {createBrowserHistory, type RouteHistory} from './navigation/History.js'
import {createNavigation, type Navigation} from './navigation/Navigation.js'
import type {Root} from './Root.js'
import {dispense} from './StoreUtils.js'
import {createWorkspace} from './Workspace.js'

export {ReactiveNode} from './ReactiveNode.js'
export * from './Editor.js'
export * from './Explorer.js'
export * from './Entry.js'
export * from './Root.js'
export * from './Workspace.js'

export const dashboardEntryOverviewColumnCount = 5

export type {DashboardRoute, Route, RouteUpdate} from '../DashboardNav.js'

export type DashboardEntryView = 'edit' | 'overview'

export interface DashboardFavicon {
  color: string
  icon?: ComponentType
}

export interface DashboardCreateEntryRequest {
  workspace: string
  root: string
  locale: string | null
  type: string
  title: string
  parentId?: string
  copyFrom?: string
  insertOrder?: 'first' | 'last'
}

export interface DashboardEntryOverviewCell {
  id: string
  field: Field
  label: string
  value: unknown
}

export interface DashboardOptions {
  alineaDev?: boolean
  history?: RouteHistory
  local?: boolean
}

export interface DashboardAuthLoading {
  status: 'loading'
}

export interface DashboardAuthMissingHandler {
  status: 'missingHandler'
}

export interface DashboardAuthMissingApiKey {
  status: 'missingApiKey'
  setupUrl: string
}

export interface DashboardAuthRedirecting {
  status: 'redirecting'
}

export interface DashboardAuthError {
  status: 'error'
  error: Error
}

export interface DashboardAuthAuthenticated {
  status: 'authenticated'
}

export type DashboardAuthState =
  | DashboardAuthLoading
  | DashboardAuthMissingHandler
  | DashboardAuthMissingApiKey
  | DashboardAuthRedirecting
  | DashboardAuthError
  | DashboardAuthAuthenticated

interface DashboardAuthCheck {
  type: 'check'
}

interface DashboardAuthSetupCloud {
  type: 'setupCloud'
}

type DashboardAuthAction = DashboardAuthCheck | DashboardAuthSetupCloud

export type DashboardTreeSelection = WritableAtom<
  Set<Key>,
  [next: 'all' | Set<Key>],
  Promise<void>
>

export function createDashboardTreeSelection(
  initialSelection = new Set<Key>()
): DashboardTreeSelection {
  const base = atom(initialSelection)
  const selection = atom(
    get => get(base),
    async (get, set, next: 'all' | Set<Key>) => {
      if (next === 'all')
        throw new Error('Selecting all items is not supported')
      set(base, next)
    }
  )
  return selection
}

type FocusedItem =
  | {entry: DashboardEntryData}
  | {root: Root}
  | {missingEntry: string; root: Root}
  | {missingRoot: string; root: Root}
  | null

export interface DashboardMutationQueue {
  entries: Array<MutationQueueEntry>
  pending: number
  syncing: number
  failed: number
  blocked: number
  error?: string
}

interface MutationQueueRetry {
  retryMutationQueue(): Promise<void>
}

interface MutationQueueDiscard {
  discardMutationQueue(): Promise<void>
}

export type DashboardTheme = 'system' | 'light' | 'dark'
export type DashboardEntrySidebarTab = 'history' | 'preview' | 'references'

export class MissingEntryError extends Error {
  constructor(public id: string) {
    super(`Missing entry ${id}`)
    this.name = 'MissingEntryError'
  }
}

const internalDashboard = atom<Store | null>(null)
export const dashboardAtom = atom(
  get => {
    const dashboard = get(internalDashboard)
    assert(dashboard, 'Dashboard not found')
    return dashboard
  },
  (get, set, dashboard: Store) => {
    set(internalDashboard, dashboard)
  }
)

const dashboardThemeStorageKey = 'alinea-dashboard-theme'

interface LogoutConnection {
  logout(): Promise<void>
}

export class Store {
  graph
  config
  client
  views
  db: Atom<WriteableGraph>
  events: Atom<EventTarget>
  #userOverride = atom<User | null | undefined>()
  #authState = atom<DashboardAuthState>({status: 'loading'})
  #mutationQueue = atom<DashboardMutationQueue>({
    entries: [],
    pending: 0,
    syncing: 0,
    failed: 0,
    blocked: 0
  })
  #loadRoute!: ReturnType<typeof createRouteLoader>
  #routeLoadSequence = 0
  #entrySidebarTab = atom<DashboardEntrySidebarTab>('preview')
  entrySidebarTab = atom(
    get => get(this.#entrySidebarTab),
    async (get, set, tab: DashboardEntrySidebarTab) => {
      const page = await get(this.page)
      if (page.type === 'entry') {
        const sidebar = await loadEntrySidebar(
          get,
          page.entry,
          page.locale,
          tab
        )
        set(this.navigation.prepared, {...page, sidebar})
      }
      set(this.#entrySidebarTab, tab)
    }
  )
  #uploadQueue = atom<Array<MutationQueueEntry>>([])
  #themeStorage = atomWithStorage<DashboardTheme>(
    dashboardThemeStorageKey,
    'system',
    undefined
  )
  #options: DashboardOptions
  #entrySideBarOpen = atom(true)
  entrySideBarOpen = atom(
    get => get(this.#entrySideBarOpen),
    async (get, set, open: boolean) => {
      const page = await get(this.page)
      if (open) {
        if (page.type === 'entry') {
          const sidebar = await loadEntrySidebar(
            get,
            page.entry,
            page.locale,
            get(this.entrySidebarTab)
          )
          set(this.navigation.prepared, {...page, sidebar})
        }
      } else {
        if (page.type === 'entry')
          set(this.navigation.prepared, {
            ...page,
            sidebar: {type: 'closed'}
          })
      }
      set(this.#entrySideBarOpen, open)
    }
  )
  navigation: Navigation<LoadedRoute>
  route: Navigation['route']
  page: Atom<LoadedRoute | Promise<LoadedRoute>>
  reloadPage = atom(null, async (get, set) => {
    const sequence = ++this.#routeLoadSequence
    const controller = new AbortController()
    const page = await this.#loadRoute(get, get(this.route), controller.signal)
    if (sequence === this.#routeLoadSequence)
      set(this.navigation.prepared, page)
  })
  refreshPageFor = atom(null, async (get, set, explorer: Explorer) => {
    const page = await get(this.page)
    if (page.type !== 'explorer') return
    if (page.root.explorer !== explorer) return
    await set(this.reloadPage)
  })

  constructor(
    graph: WriteableGraph,
    config: Config,
    events: EventTarget,
    client: LocalConnection,
    views: Record<string, ComponentType>,
    options: DashboardOptions = {}
  ) {
    this.graph = atom(graph)
    this.config = atom(config)
    this.events = atom(events)
    this.client = atom(client)
    this.views = atom(views)
    this.#options = options
    this.db = Object.assign(
      atom(
        get => get(this.graph),
        (get, set) => {
          const events = get(this.events)
          // Listen to db changes and update entry revisions
          const listen = (event: Event) => {
            if (event instanceof IndexEvent && event.data.op === 'entry') {
              const id = event.data.id
              set(this.revisions(id), current => current + 1)
              if (get(this.route).entry === id) void set(this.reloadPage)
            }
          }
          events.addEventListener(IndexEvent.type, listen)
          return () => {
            events.removeEventListener(IndexEvent.type, listen)
          }
        }
      ),
      {
        onMount(init: () => void) {
          init()
        }
      }
    )
    const history = options.history ?? createBrowserHistory()
    const loadRoute = createRouteLoader({
      policy: this.#policyResource,
      canManageMembers: this.canManageMembers,
      workspaces: this.workspaces,
      workspace: key => this.workspace(key),
      entry: id => this.entries(id)
    })
    this.#loadRoute = loadRoute
    const initialPage = atom(async get => {
      return loadRoute(get, history.read(), new AbortController().signal)
    })
    this.navigation = createNavigation<LoadedRoute>({
      history,
      allow: async (_route, {get, set, signal}) => {
        const page = await get(this.page)
        if (signal.aborted) return false
        if (page.type !== 'entry') return true
        return set(page.entry.needsBlock, signal)
      },
      prepare: async (route, {get, signal}) => {
        const page = await loadRoute(get, route, signal)
        this.#routeLoadSequence++
        return page
      }
    })
    this.route = this.navigation.route
    this.page = atom(get => get(this.navigation.prepared) ?? get(initialPage))
  }

  previewMetadata = atom<PreviewMetadata | undefined>(undefined)

  #previewSessionOrigins = atom<Record<string, true>>({})
  #previewTokenRequests = new Map<string, Promise<string>>()
  previewSessionOrigins = atom(get => get(this.#previewSessionOrigins))

  previewSessionToken(origin: string, client: LocalConnection) {
    const current = this.#previewTokenRequests.get(origin)
    if (current) return current
    const request = client.previewToken().finally(() => {
      if (this.#previewTokenRequests.get(origin) === request)
        this.#previewTokenRequests.delete(origin)
    })
    this.#previewTokenRequests.set(origin, request)
    return request
  }

  markPreviewSessionReady = atom(null, (get, set, origin: string) => {
    if (get(this.#previewSessionOrigins)[origin]) return
    set(this.#previewSessionOrigins, current => ({
      ...current,
      [origin]: true
    }))
  })

  revisions = dispense(_id => atom(0))

  authRequired = atom((_get): boolean => {
    const forceAuth =
      typeof process !== 'undefined' && process.env.ALINEA_FORCE_AUTH
    if (forceAuth) return true
    const {alineaDev, local} = this.#options
    return !(alineaDev || local)
  })

  get isLocal() {
    const {alineaDev, local} = this.#options
    return alineaDev || local
  }

  auth = Object.assign(
    atom(
      get => {
        if (!get(this.authRequired)) {
          return {status: 'authenticated'} satisfies DashboardAuthState
        }
        return get(this.#authState)
      },
      async (get, set, action: DashboardAuthAction = {type: 'check'}) => {
        if (action.type === 'setupCloud') {
          const state = get(this.#authState)
          if (state.status !== 'missingApiKey') return
          window.location.href = appendFrom(state.setupUrl)
          return
        }

        if (!get(this.authRequired)) {
          set(this.#authState, {status: 'authenticated'})
          return
        }

        const client = get(this.client)
        if (!(client instanceof Client)) {
          set(this.#authState, {
            status: 'error',
            error: new Error('Cannot authenticate with non http client')
          })
          return
        }

        set(this.#authState, {status: 'loading'})
        try {
          const result = await client.authStatus()
          switch (result.type) {
            case AuthResultType.NeedsRefresh:
              set(this.#authState, {
                status: 'error',
                error: new Error(
                  'Authentication failure, please refresh the page'
                )
              })
              return
            case AuthResultType.Authenticated:
              set(
                this.client,
                client.authenticate(
                  options => options,
                  () => {
                    set(this.#userOverride, null)
                    set(this.#authState, {status: 'loading'})
                    set(this.auth, {type: 'check'})
                  }
                )
              )
              set(this.#userOverride, result.user)
              set(this.#authState, {status: 'authenticated'})
              return
            case AuthResultType.UnAuthenticated:
              set(this.#authState, {status: 'redirecting'})
              window.location.href = appendFrom(result.redirect)
              return
            case AuthResultType.MissingApiKey:
              set(this.#authState, {
                status: 'missingApiKey',
                setupUrl: result.setupUrl
              })
              return
          }
        } catch {
          set(this.#authState, {status: 'missingHandler'})
        }
      }
    ),
    {
      onMount(checkAuth: (action?: DashboardAuthAction) => void) {
        checkAuth({type: 'check'})
      }
    }
  )

  user = swr(
    atom(async get => {
      const override = get(this.#userOverride)
      if (override !== undefined) return override
      if (!get(this.authRequired)) {
        const userData =
          typeof process !== 'undefined' &&
          (process.env.ALINEA_USER as string | undefined)
        if (!userData) return localUser
        return JSON.parse(userData) as User
      }
      return get(this.client).user()
    })
  )

  currentUser = unwrap(this.user)

  setUserRoles = atom(null, async (get, set, roles: Array<string>) => {
    const user = await get(this.user)
    if (!user) return
    set(this.#userOverride, {...user, roles})
  })

  authenticate = atom(null, (get, set, user: User) => {
    const client = get(this.client)
    if (client instanceof Client) {
      set(
        this.client,
        client.authenticate(
          options => options,
          () => {
            set(this.#userOverride, null)
            set(this.#authState, {status: 'loading'})
            set(this.auth, {type: 'check'})
          }
        )
      )
    }
    set(this.#userOverride, user)
  })

  logout = atom(null, async (get, set) => {
    const client = get(this.client)
    const logout = (client as Partial<LogoutConnection>).logout
    if (typeof logout === 'function') await logout.call(client)
    set(this.#userOverride, null)
    if (get(this.authRequired)) await set(this.auth, {type: 'check'})
  })

  mutationQueue = Object.assign(
    atom(
      get => {
        const uploads = get(this.#uploadQueue)
        const queue = get(this.#mutationQueue)
        if (uploads.length === 0) return queue
        return mutationQueueState([...uploads, ...queue.entries])
      },
      (get, set) => {
        const events = get(this.events)
        const listen = (event: Event) => {
          if (event instanceof MutationQueueEvent) {
            set(this.#mutationQueue, mutationQueueState(event.entries))
          }
        }
        events.addEventListener(MutationQueueEvent.type, listen)
        return () => {
          events.removeEventListener(MutationQueueEvent.type, listen)
        }
      }
    ),
    {onMount: (init: () => void) => init()}
  )

  retryMutationQueue = atom(null, async get => {
    const db = get(this.db)
    const retry = (db as Partial<MutationQueueRetry>).retryMutationQueue
    if (retry) await retry.call(db)
  })

  discardMutationQueue = atom(null, async (get, set) => {
    const db = get(this.db)
    const discard = (db as Partial<MutationQueueDiscard>).discardMutationQueue
    if (discard) await discard.call(db)
    set(this.#uploadQueue, [])
  })

  uploadProgress = atom(
    null,
    (
      get,
      set,
      update:
        | {
            type: 'start'
            uploads: Array<{id: string; file: File}>
            destination: MutationQueueEntry['upload']
          }
        | {
            type: 'progress'
            id: string
            progress: UploadProgress
          }
        | {
            type: 'finish'
            ids: Array<string>
          }
        | {
            type: 'fail'
            uploads: Array<{id: string; file: File; error: string}>
            destination: MutationQueueEntry['upload']
          }
    ) => {
      if (update.type === 'start') {
        set(this.#uploadQueue, current => [
          ...update.uploads.map(
            ({id, file}): MutationQueueEntry => ({
              id,
              status: 'syncing',
              upload: update.destination,
              mutations: [
                {
                  op: 'uploadFile',
                  title: file.name,
                  progress: {loaded: 0, total: file.size || undefined}
                }
              ]
            })
          ),
          ...current
        ])
        return
      }
      if (update.type === 'progress') {
        set(this.#uploadQueue, current =>
          current.map(entry => {
            if (entry.id !== update.id) return entry
            return {
              ...entry,
              mutations: entry.mutations.map(mutation => ({
                ...mutation,
                progress: update.progress
              }))
            }
          })
        )
        return
      }
      if (update.type === 'fail') {
        set(this.#uploadQueue, current => [
          ...update.uploads.map(
            ({id, file, error}): MutationQueueEntry => ({
              id,
              status: 'failed',
              error,
              upload: update.destination,
              mutations: [
                {
                  op: 'uploadFile',
                  title: file.name,
                  progress: {loaded: 0, total: file.size || undefined}
                }
              ]
            })
          ),
          ...current
        ])
        return
      }
      set(this.#uploadQueue, current =>
        current.filter(entry => !update.ids.includes(entry.id))
      )
    }
  )

  canLogout = atom(get => {
    if (!get(this.authRequired)) return false
    const client = get(this.client)
    return typeof (client as Partial<LogoutConnection>).logout === 'function'
  })

  #backendCapabilitiesResource = atom(async get => {
    const client = get(this.client)
    if (!client.capabilities)
      throw new Error('Backend capabilities are not available')
    return client.capabilities()
  })

  #policyResource = atom(async get => {
    const user = await get(this.user)
    if (!user?.roles) return Policy.ALLOW_NONE
    const db = get(this.db)
    get(this.sha) // subscribe to content changes
    const roles = get(this.config).roles ?? {}
    return db.createPolicy(user.roles.filter(role => role in roles))
  })

  #policyState = atomWithPending(this.#policyResource)

  policyReady = atom(get => {
    const [pending] = get(this.#policyState)
    return !pending
  })

  canManageMembers = atom(async get => {
    const capabilities = await get(this.#backendCapabilitiesResource)
    if (!capabilities.users) return false
    const policy = await get(this.#policyResource)
    return policy.canManageMembers()
  })

  #initialContentLoaded = atom(false)

  #initialContentResource = atom(async get => {
    if (get(this.#initialContentLoaded)) return true
    await get(this.page)
    const workspace = get(this.currentWorkspace)
    if (!workspace) return true
    const roots = get(workspace.roots)
    if (roots.length === 0) return true
    await get(workspace.tree.items)
    return true
  })

  initialContentAvailable = Object.assign(
    atom(
      get => get(this.#initialContentResource),
      async (get, set) => {
        await get(this.#initialContentResource)
        set(this.#initialContentLoaded, true)
      }
    ),
    {
      onMount(load: () => void) {
        load()
      }
    }
  )

  policy = atom(get => {
    const [, policy] = get(this.#policyState)
    return policy ?? Policy.ALLOW_NONE
  })

  focused = atom((get): FocusedItem | Promise<FocusedItem> => {
    const {page} = get(this.route)
    if (page === 'users') return null
    const workspace = get(this.selectedWorkspace)
    const root = get(this.selectedRoot)
    const {root: routeRoot, entry} = get(this.route)
    const rootFocus = (): FocusedItem => {
      if (!workspace) return null
      if (root) return {root: this.workspace(workspace).root(root)}
      return null
    }
    const missingEntryFocus = (error: unknown): FocusedItem => {
      if (!(error instanceof MissingEntryError)) throw error
      if (workspace && root) {
        return {
          missingEntry: entry!,
          root: this.workspace(workspace).root(root)
        }
      }
      throw new Error(`Entry "${entry}" not found`)
    }
    const entryFocus = (data: DashboardEntryData): FocusedItem => {
      return get(data.view) === 'edit' ? {entry: data} : rootFocus()
    }
    if (workspace && routeRoot && routeRoot !== root) {
      if (!root) return null
      return {
        missingRoot: routeRoot,
        root: this.workspace(workspace).root(root)
      }
    }
    if (entry)
      try {
        const model = this.entries(entry)
        const {data, error} = get(model.data)
        if (error) return missingEntryFocus(error)
        if (data) return entryFocus(data)
        return null
      } catch (error) {
        return missingEntryFocus(error)
      }
    return rootFocus()
  })

  #sha = atom<string>()
  sha = Object.assign(
    atom(
      async get => {
        const current = get(this.#sha)
        if (current) return current
        const db = get(this.db)
        if (!isSyncableGraph(db)) return undefined
        return db.sync()
      },
      (get, set) => {
        const events = get(this.events)
        const listen = (event: Event) => {
          if (event instanceof IndexEvent && event.data.op === 'index') {
            const sha = event.data.sha
            set(this.#sha, sha)
          }
        }
        events.addEventListener(IndexEvent.type, listen)
        return () => {
          events.removeEventListener(IndexEvent.type, listen)
        }
      }
    ),
    {onMount: (init: () => void) => init()}
  )

  sync = atom(null, async (get, set) => {
    const db = get(this.db)
    if (!isSyncableGraph(db)) return
    const sync = db.sync()
    const sha = await sync
    set(this.#sha, sha)
    return sha
  })

  theme = Object.assign(
    atom(
      get => get(this.#themeStorage),
      (get, set, next: SetStateAction<DashboardTheme>) => {
        const current = get(this.#themeStorage)
        const theme = typeof next === 'function' ? next(current) : next
        set(this.#themeStorage, theme)
        applyDashboardTheme(theme)
      }
    ),
    {
      onMount(setTheme: (update: SetStateAction<DashboardTheme>) => void) {
        setTheme(current => current)
      }
    }
  )

  selectedWorkspace = atom(
    get => {
      const {workspace} = get(this.route)
      const config = get(this.config)
      const workspaceKeys = get(this.workspaces)
      if (workspace && config.workspaces[workspace]) {
        if (workspaceKeys.includes(workspace)) return workspace
      }
      return workspaceKeys[0] ?? null
    },
    (get, set, workspace: string) => {
      return set(this.route, {workspace})
    }
  )

  selectedRoot = atom<string | null>(get => {
    const workspace = get(this.currentWorkspace)
    const roots = workspace ? get(workspace.roots) : []
    const {root} = get(this.route)
    if (root && roots.includes(root)) return root
    return roots[0] ?? null
  })

  workspaces = atom(get => {
    const config = get(this.config)
    const policy = get(this.policy)
    return Object.keys(config.workspaces).filter(workspace => {
      return policy.canRead({workspace})
    })
  })

  workspace = dispense(key => {
    assert(key, 'Workspace key cannot be empty')
    return createWorkspace(this, key)
  })

  workspaceMenu = atom(get => {
    const workspaces = get(this.workspaces)
    return workspaces.map(workspace => ({
      id: workspace,
      label: get(this.workspace(workspace).label),
      icon: get(this.workspace(workspace).icon)
    }))
  })

  currentWorkspace = atom(get => {
    const workspaceKey = get(this.selectedWorkspace)
    return workspaceKey ? this.workspace(workspaceKey) : null
  })

  selectedMediaRoot = atom(get => {
    const workspace = get(this.currentWorkspace)
    if (!workspace) return null
    const roots = get(workspace.roots)
    return roots.find(root => get(workspace.root(root).isMedia)) ?? null
  })

  title = swr(
    atom(async get => {
      const route = get(this.route)
      if (route.page === 'users') return 'Users'
      const workspace = get(this.currentWorkspace)
      const workspaceLabel = workspace ? get(workspace.label) : 'Alinea'
      const focused = await get(this.focused)
      let viewLabel = workspaceLabel
      if (focused) {
        if ('entry' in focused) viewLabel = get(focused.entry.label)
        else if ('missingEntry' in focused) viewLabel = 'Entry not found'
        else if ('missingRoot' in focused) viewLabel = 'Root not found'
        else viewLabel = get(focused.root.label)
      }
      return viewLabel === workspaceLabel
        ? workspaceLabel
        : `${workspaceLabel}: ${viewLabel}`
    })
  )

  favicon = atom((get): DashboardFavicon => {
    const workspace = get(this.currentWorkspace)
    if (!workspace) return {color: '#7c3aed'}
    return {
      color: get(workspace.color),
      icon: get(workspace.icon)
    }
  })

  currentRoot = atom(get => {
    const workspace = get(this.currentWorkspace)
    const rootKey = get(this.selectedRoot)
    if (!workspace || !rootKey) return null
    return workspace.root(rootKey)
  })

  type = dispense(key => {
    return atom(get => {
      const config = get(this.config)
      const type = config.schema[key]
      assert(type, `Type "${key}" not found in config`)
      return createType(this, type)
    })
  })

  view = dispense(key => {
    return atom((get): ComponentType | undefined => {
      const views = get(this.views)
      return views[key]
    })
  })

  explore(initialLocation: ExplorerLocation, options: ExplorerOptions = {}) {
    const firstSelection = options.location
      ? undefined
      : options.initialSelection?.[0]
    const selectedLocation = atom(async get => {
      if (!firstSelection) return undefined
      const {data} = await get(this.entries(firstSelection).readyState)
      if (!data) return undefined
      return {
        workspace: get(data.workspaceKey),
        root: get(data.rootKey),
        parentId: get(data.parentId) ?? undefined
      } satisfies ExplorerLocation
    })
    const fallbackLocation = atom(initialLocation)
    const hasManualLocation = atom(false)
    const location = atom(
      get => {
        if (get(hasManualLocation)) return get(fallbackLocation)
        return (
          get(unwrap(selectedLocation, previous => previous)) ??
          get(fallbackLocation)
        )
      },
      (get, set, update: SetStateAction<ExplorerLocation>) => {
        const current = get(location)
        const next = typeof update === 'function' ? update(current) : update
        set(hasManualLocation, true)
        set(fallbackLocation, next)
      }
    )
    return createExplorer(this, location, options)
  }

  entries = dispense(id => {
    return createEntry(this, id)
  })

  versionLoader = atom(get => {
    const db = get(this.db)
    return loader(async ids => {
      const rows = await db.find({
        id: {in: ids},
        status: 'all',
        select: Entry
      })
      return ids.map(id => {
        return [rows.filter(row => row.id === id), null] as const
      })
    })
  })

  entryLoader = atom(get => {
    const config = get(this.config)
    const db = get(this.db)
    const policy = get(this.policy)
    const visibleTypes = entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
    return loader(async ids => {
      const rows = await db.find({
        groupBy: Entry.id,
        select: {
          id: Entry.id,
          type: Entry.type,
          parentId: Entry.parentId,
          workspace: Entry.workspace,
          root: Entry.root,
          parents: parents({
            select: {
              id: Entry.id,
              path: Entry.path,
              type: Entry.type,
              status: Entry.status,
              main: Entry.main
            }
          }),
          entries: translations({select: Entry, includeSelf: true})
        },
        id: {in: ids},
        status: 'preferDraft'
      })
      const parentIds = await db.find({
        select: Entry.parentId,
        parentId: {in: ids},
        filter: {_type: {in: visibleTypes}},
        groupBy: Entry.parentId,
        status: 'preferDraft'
      })
      const byId = new Map(rows.map(row => [row.id, row] as const))
      return ids.map(id => {
        const row = byId.get(id)
        if (!row) return [null, new MissingEntryError(id)] as const
        const readableEntries = row.entries.filter(entry =>
          policy.canRead(entry)
        )
        if (readableEntries.length === 0)
          return [null, new MissingEntryError(id)] as const
        return [
          {
            ...row,
            entries: readableEntries,
            hasChildren: parentIds.includes(id)
          },
          null
        ] as const
      })
    })
  })

  createEntry = atom(
    null,
    async (get, set, request: DashboardCreateEntryRequest) => {
      const config = get(this.config)
      const db = get(this.db)
      const policy = get(this.policy)
      const type = config.schema[request.type]
      assert(type, `Type "${request.type}" not found in config`)

      const title = request.title.trim()
      assert(title, 'Title is required')

      const copiedData = request.copyFrom
        ? await db.first({
            select: Entry.data,
            id: request.copyFrom,
            locale: request.locale,
            status: 'preferPublished'
          })
        : undefined

      const parent = request.parentId
        ? await db.first({
            select: {type: Entry.type, parents: Entry.parents},
            id: request.parentId,
            status: 'preferDraft'
          })
        : undefined
      const parentType = parent ? config.schema[parent.type] : undefined
      const parentInsertOrder = parentType && Type.insertOrder(parentType)
      policy.assert(Permission.Create, {
        workspace: request.workspace,
        root: request.root,
        locale: request.locale,
        type: request.type,
        parents: request.parentId
          ? [request.parentId, ...(parent?.parents ?? [])]
          : []
      })

      const user = await get(this.user)
      const initialData = Type.withInitialValue(type, {
        ...Type.initialValue(type),
        ...copiedData,
        title,
        path: slugify(title)
      })
      const data = Type.beforeSave(type, initialData, {
        action: 'create',
        user,
        now: new Date()
      })

      const created = await db.create({
        type,
        workspace: request.workspace,
        root: request.root,
        parentId: request.parentId,
        locale: request.locale,
        status:
          type === MediaLibrary || !config.enableDrafts ? 'published' : 'draft',
        insertOrder:
          parentInsertOrder && parentInsertOrder !== 'free'
            ? parentInsertOrder
            : request.insertOrder,
        set: data
      })

      set(this.route, {
        workspace: request.workspace,
        root: request.root,
        entry: created._id,
        locale: request.locale ?? undefined
      })

      return created
    }
  )
}

export function createStore(...args: ConstructorParameters<typeof Store>) {
  return new Store(...args)
}

/** @deprecated Use Store or createStore. */
export {Store as Dashboard}

type Result<Value> = [value: Value, error: null] | [value: null, error: Error]
type BatchLoadFn<V> = (
  keys: ReadonlyArray<string>
) => Promise<ReadonlyArray<Result<V>>>
function loader<Value>(fn: BatchLoadFn<Value>) {
  let batch: {key: string; resolve: (v: Result<Value>) => void}[] = []
  return (key: string): Promise<Result<Value>> => {
    return new Promise(resolve => {
      if (batch.push({key, resolve}) === 1) {
        queueMicrotask(async () => {
          const current = batch
          batch = []
          try {
            const result = await fn(current.map(i => i.key))
            for (const [index, item] of current.entries())
              item.resolve(
                result[index] ?? [
                  null,
                  new Error(`Missing result for ${item.key}`)
                ]
              )
          } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e))
            for (const item of current) item.resolve([null, err])
          }
        })
      }
    })
  }
}

function swr<Value>(asyncAtom: Atom<Promise<Value>>) {
  const withPrev = unwrap(asyncAtom, prev => prev)
  return atom(get => {
    const current = get(withPrev)
    return current ?? get(asyncAtom)
  })
}

function mutationQueueState(
  entries: Array<MutationQueueEntry>
): DashboardMutationQueue {
  return {
    entries,
    pending: entries.filter(entry => entry.status === 'pending').length,
    syncing: entries.filter(entry => entry.status === 'syncing').length,
    failed: entries.filter(entry => entry.status === 'failed').length,
    blocked: entries.filter(entry => entry.status === 'blocked').length,
    error: entries.find(entry => entry.status === 'failed')?.error
  }
}

function appendFrom(url: string): string {
  const {location} = window
  const from = encodeURIComponent(
    `${location.protocol}//${location.host}${location.pathname}`
  )
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}from=${from}`
}

function atomWithPending<Value>(asyncAtom: Atom<Promise<Value> | Value>) {
  const wrappedAtom = atom(async get => {
    const data = await get(asyncAtom)
    return [false, data] as const
  })
  return unwrap(wrappedAtom, prev => [true, prev?.[1]] as const)
}

let enableThemeTransitionsFrame: number | undefined

function suspendTransitionsDuringThemeChange() {
  if (typeof document === 'undefined') return
  const {body} = document
  if (!body) return
  body.dataset.disableTransition = 'true'
  void body.offsetWidth
  if (enableThemeTransitionsFrame)
    cancelAnimationFrame(enableThemeTransitionsFrame)
  enableThemeTransitionsFrame = requestAnimationFrame(() => {
    enableThemeTransitionsFrame = requestAnimationFrame(() => {
      body.removeAttribute('data-disable-transition')
      enableThemeTransitionsFrame = undefined
    })
  })
}

function applyDashboardTheme(theme: DashboardTheme) {
  if (typeof document === 'undefined') return
  suspendTransitionsDuringThemeChange()
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = theme
}

interface SyncableGraph {
  sync: () => Promise<string>
}

function isSyncableGraph(
  graph: WriteableGraph
): graph is WriteableGraph & SyncableGraph {
  return typeof (graph as Partial<SyncableGraph>).sync === 'function'
}
