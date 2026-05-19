import {JsonLoader} from '#/backend/loader/JsonLoader.js'
import {AuthResultType} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import {Config} from '#/core/Config.js'
import type {LocalConnection, Revision} from '#/core/Connection.js'
import {IndexEvent} from '#/core/db/IndexEvent.js'
import {UploadOperation, type UploadProgress} from '#/core/db/Operation.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {Entry, EntryStatus} from '#/core/Entry.js'
import type {EntryFields} from '#/core/EntryFields.js'
import {createRecord, parseRecord} from '#/core/EntryRecord.js'
import type {Expr} from '#/core/Expr.js'
import {Field, FieldOptions} from '#/core/Field.js'
import type {Filter} from '#/core/Filter.js'
import type {Order} from '#/core/Graph.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {createPreview} from '#/core/media/CreatePreview.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import type {PreviewMetadata} from '#/core/Preview.js'
import {Permission, Policy, type Resource} from '#/core/Role.js'
import {getScope} from '#/core/Scope.js'
import {Section} from '#/core/Section.js'
import {createFilePatch} from '#/core/source/FilePatch.js'
import {FieldGetter, optionTrackerOf} from '#/core/Tracker.js'
import {Type} from '#/core/Type.js'
import {localUser, type User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {entries, fromEntries, values} from '#/core/util/Objects.js'
import {join} from '#/core/util/Paths.js'
import {slugify} from '#/core/util/Slugs.js'
import {encodePreviewPayload} from '#/preview/PreviewPayload.js'
import {parents, translations} from '#/query.js'
import {Infer} from '#/types.js'
import {
  DragItem,
  type DragTypes,
  type DropItem,
  type DropOperation,
  type DropTarget,
  type ItemDropTarget
} from '@react-types/shared'
import type {Atom, Getter, Setter, WritableAtom} from 'jotai'
import {atom} from 'jotai'
import {atomWithLocation} from 'jotai-location'
import {atomWithStorage, unwrap} from 'jotai/utils'
import {SetStateAction, startTransition, type ComponentType} from 'react'
import type {
  DroppableCollectionInsertDropEvent,
  DroppableCollectionOnItemDropEvent,
  DroppableCollectionReorderEvent,
  Key
} from 'react-aria-components'
import {
  MutationQueueEvent,
  type MutationQueueEntry
} from '../boot/MutationQueueEvent.js'
import {IcRoundDescription} from '../icons.js'

export interface DashboardRoute {
  workspace?: string
  root?: string
  entry?: string
  locale?: string
}

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

export interface DashboardOptions {
  alineaDev?: boolean
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

type DashboardTreeSelection = WritableAtom<
  Set<Key>,
  [next: 'all' | Set<Key>],
  Promise<void>
>

type FocusedItem =
  | {entry: DashboardEntryData}
  | {root: DashboardRoot}
  | {missingEntry: string; root: DashboardRoot}
  | {missingRoot: string; root: DashboardRoot}
  | null

export interface DashboardMutationQueue {
  entries: Array<MutationQueueEntry>
  pending: number
  syncing: number
  failed: number
  blocked: number
  error?: string
}

type DashboardUploadFiles = Iterable<File> | ArrayLike<File>

interface MutationQueueRetry {
  retryMutationQueue(): Promise<void>
}

interface MutationQueueDiscard {
  discardMutationQueue(): void
}

export type DashboardTheme = 'system' | 'light' | 'dark'

export class MissingEntryError extends Error {
  constructor(public id: string) {
    super(`Missing entry ${id}`)
    this.name = 'MissingEntryError'
  }
}

const internalDashboard = atom<Dashboard | null>(null)
export const dashboardAtom = atom(
  get => {
    const dashboard = get(internalDashboard)
    assert(dashboard, 'Dashboard not found')
    return dashboard
  },
  (get, set, dashboard: Dashboard) => {
    set(internalDashboard, dashboard)
  }
)

const dashboardThemeStorageKey = 'alinea-dashboard-theme'

interface LogoutConnection {
  logout(): Promise<void>
}

export class Dashboard {
  graph
  config
  client
  views
  db: Atom<WriteableGraph>
  events: Atom<EventTarget>
  #userOverride = atom<User | null | undefined>()
  #authRevision = atom(0)
  #authState = atom<DashboardAuthState>({status: 'loading'})
  #mutationQueue = atom<DashboardMutationQueue>({
    entries: [],
    pending: 0,
    syncing: 0,
    failed: 0,
    blocked: 0
  })
  #uploadQueue = atom<Array<MutationQueueEntry>>([])
  #themeStorage = atomWithStorage<DashboardTheme>(
    dashboardThemeStorageKey,
    'system',
    undefined
  )
  #options: DashboardOptions

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
              startTransition(() =>
                set(this.revisions(id), current => current + 1)
              )
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
  }

  previewMetadata = atom<PreviewMetadata | undefined>(undefined)

  revisions = dispense(id => atom(0))

  authRequired = atom((get): boolean => {
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
        get(this.#authRevision)
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
                    set(this.#authRevision, revision => revision + 1)
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
            set(this.#authRevision, revision => revision + 1)
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
    set(this.#authRevision, revision => revision + 1)
    if (get(this.authRequired)) await set(this.auth, {type: 'check'})
  })

  authRevision = atom(get => get(this.#authRevision))

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
            startTransition(() =>
              set(this.#mutationQueue, mutationQueueState(event.entries))
            )
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

  discardMutationQueue = atom(null, get => {
    const db = get(this.db)
    const discard = (db as Partial<MutationQueueDiscard>).discardMutationQueue
    if (discard) discard.call(db)
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

  #policyResource = atom(async get => {
    await get(this.ensureInitialSync)
    const user = await get(this.user)
    if (!user) return Policy.ALLOW_NONE
    const db = get(this.db)
    get(this.sha) // subscribe to content changes
    return db.createPolicy(user.roles)
  })

  #policyState = atomWithPending(this.#policyResource)

  policyReady = atom(get => {
    const [pending] = get(this.#policyState)
    return !pending
  })

  policy = atom(get => {
    const [, policy] = get(this.#policyState)
    return policy ?? Policy.ALLOW_NONE
  })

  #location = atomWithLocation({
    subscribe(setLocation) {
      // workaround facebook/react#35966
      const transition = () =>
        requestAnimationFrame(() => startTransition(setLocation))
      window.addEventListener('popstate', transition)
      return () => window.removeEventListener('popstate', transition)
    }
  })

  route = atom(
    get => {
      const {hash = '/'} = get(this.#location)
      const [action, workspace, rootPart = '', entry] = hash
        .slice(1)
        .split('/')
        .slice(1) as Array<string | undefined>
      const [root, locale] = rootPart.split(':')
      return {workspace, root, entry, locale}
    },
    async (get, set, update: DashboardRoute) => {
      const focused = await get(this.focused)
      const confirm = () => {
        let {workspace, root, entry, locale} = update
        const rootPart = root ? `${root}${locale ? `:${locale}` : ''}` : ''
        const pathname = `/entry/${[workspace, rootPart, entry].filter(Boolean).join('/')}`
        startTransition(() => {
          set(this.#location, {hash: `#${pathname}`})
        })
      }
      if (focused && 'entry' in focused) {
        const blockNavigation = set(focused.entry.needsBlock, confirm)
        if (blockNavigation) return
      }
      confirm()
    }
  )

  focused = atom((get): FocusedItem | Promise<FocusedItem> => {
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
      const type = get(data.type)
      if (type.type !== MediaLibrary) return {entry: data}
      return rootFocus()
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
        const [, data] = get(model.data)
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
      get => get(this.#sha),
      (get, set) => {
        const events = get(this.events)
        const listen = (event: Event) => {
          if (event instanceof IndexEvent && event.data.op === 'index') {
            const sha = event.data.sha
            startTransition(() => set(this.#sha, sha))
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

  ensureInitialSync = atom(get => {
    const db = get(this.db)
    if (!isSyncableGraph(db)) return
    return db.sync()
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
      startTransition(() => {
        set(this.route, {workspace})
      })
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
    return new DashboardWorkspace(this, key)
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

  title = swr(
    atom(async get => {
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
      return new DashboardType(this, type)
    })
  })

  view = dispense(key => {
    return atom((get): ComponentType | undefined => {
      const views = get(this.views)
      return views[key]
    })
  })

  explore(initialLocation: ExplorerLocation, options: ExplorerOptions = {}) {
    return new DashboardExplorer(this, atom(initialLocation), options)
  }

  entries = dispense(id => {
    return new DashboardEntry(this, id)
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
    const db = get(this.db)
    const policy = get(this.policy)
    return loader(async ids => {
      const data = {
        id: Entry.id,
        type: Entry.type,
        title: Entry.title,
        status: Entry.status,
        locale: Entry.locale,
        main: Entry.main,
        path: Entry.path,
        parentId: Entry.parentId,
        parents: Entry.parents,
        seeded: Entry.seeded,
        workspace: Entry.workspace,
        root: Entry.root,
        url: Entry.url,
        data: Entry.data,
        fileHash: Entry.fileHash,
        filePath: Entry.filePath
      }
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
          entries: translations({select: data, includeSelf: true})
        },
        id: {in: ids},
        status: 'preferDraft'
      })
      const parentIds = await db.find({
        select: Entry.parentId,
        parentId: {in: ids},
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

      const created = await db.create({
        type,
        workspace: request.workspace,
        root: request.root,
        parentId: request.parentId,
        locale: request.locale,
        status: config.enableDrafts ? 'draft' : 'published',
        insertOrder:
          parentInsertOrder && parentInsertOrder !== 'free'
            ? parentInsertOrder
            : request.insertOrder,
        set: {
          ...Type.initialValue(type),
          ...copiedData,
          title,
          path: slugify(title)
        }
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

export class DashboardEditor {
  value: Atom<object>
  sections: Array<DashboardSection>
  constructor(
    public dashboard: Dashboard,
    public type: Type,
    public node: ReactiveNode<object>,
    public parent?: DashboardEditor,
    public resource?: Resource
  ) {
    this.resource ??= parent?.resource
    this.value = node.value
    this.sections = getType(this.type).sections.map(
      section => new DashboardSection(this.dashboard, section)
    )
  }
  field = dispense(key => {
    const fields = getType(this.type).allFields
    const field = fields[key]
    if (!field) return undefined
    return new DashboardField(this, key, field)
  })
  get(field: Field): DashboardField | undefined {
    const fields = getType(this.type).allFields
    for (const [key, candidate] of Object.entries(fields)) {
      if (candidate === field) return this.field(key)
    }
    return this.parent?.get(field)
  }
}

export class DashboardSection {
  constructor(
    public dashboard: Dashboard,
    public section: Section
  ) {}

  view = atom(get => {
    const view = Section.view(this.section)
    if (typeof view === 'string') return get(this.dashboard.view(view))
    return view
  })
}

export interface ExplorerLocation {
  workspace: string
  root?: string
  parentId?: string
}

export interface DashboardMenuItem {
  id: string
  label: string
}

export type ExplorerSortBy = 'title' | 'path' | 'size' | 'id'
export type ExplorerSortDirections = 'asc' | 'desc'
export type ExplorerSort = {
  sortBy: ExplorerSortBy
  direction: ExplorerSortDirections
}

export type ExplorerTypeFilters = typeof MediaFile | typeof MediaLibrary

export interface ExplorerOptions {
  condition?: Filter<EntryFields>
  location?: ExplorerLocation
  selectionMode?: 'single' | 'multiple'
  selectionBehavior?: 'toggle' | 'replace'
  initialSelection?: Array<string>
  searchDepth?: 'current' | 'all'
  // initialSort?: ExplorerSort
  onAction?: WritableAtom<void, [entry: DashboardEntry], void>
  onConfirm?: (selection: Array<string>) => void
}

export class DashboardExplorer {
  #location: WritableAtom<
    ExplorerLocation,
    [SetStateAction<ExplorerLocation>],
    void
  >
  #options: ExplorerOptions
  selection
  constructor(
    public dashboard: Dashboard,
    location: WritableAtom<
      ExplorerLocation,
      [SetStateAction<ExplorerLocation>],
      void
    >,
    options: ExplorerOptions
  ) {
    this.#location = location
    this.#options = options
    this.selection = atom<'all' | Set<Key>>(
      new Set<Key>(options.initialSelection)
    )
  }

  get selectionMode() {
    return this.#options.selectionMode ?? 'single'
  }

  get selectionBehavior() {
    return this.#options.selectionBehavior ?? 'replace'
  }

  onAction = atom(null, (get, set, entry: DashboardEntry) => {
    if (this.#options.onAction) {
      set(this.#options.onAction, entry)
      return
    }
    const [, data] = get(entry.data)
    if (data && get(data.hasChildren)) {
      const location = get(this.location)
      set(this.location, {...location, parentId: entry.id})
    }
  })

  onConfirm = atom(null, (get, set) => {
    const selection = get(this.selection)
    if (this.#options.onConfirm)
      this.#options.onConfirm([...selection].map(String))
  })

  search = atom('')
  #selectedView = atom<'card' | 'row' | undefined>()
  view = atom(
    get => {
      const selected = get(this.#selectedView)
      if (selected) return selected
      const isMedia = get(this.isMedia)
      return isMedia ? 'card' : 'row'
    },
    (get, set, next: 'card' | 'row') => {
      set(this.#selectedView, next)
    }
  )
  #sort = atom<ExplorerSort>({sortBy: 'title', direction: 'asc'})
  sort = atom(
    get => get(this.#sort),
    (get, set, sortBy: ExplorerSortBy) => {
      const sort = get(this.#sort)
      const direction =
        sort.sortBy === sortBy && sort.direction === 'desc' ? 'asc' : 'desc'
      set(this.#sort, {sortBy, direction})
    }
  )
  #filter = atom<ExplorerTypeFilters | undefined>(undefined)
  filter = atom(
    get => get(this.#filter),
    (get, set, filterBy: ExplorerTypeFilters) => {
      const filter = get(this.#filter)
      const payload = filter === filterBy ? undefined : filterBy
      set(this.#filter, payload)
    }
  )
  location = atom(
    get => get(this.#location),
    (get, set, update: SetStateAction<ExplorerLocation>) => {
      set(this.#location, update)
    }
  )
  getItems = atom(null, (get, set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(id => dragItem(id))
  })

  isMedia = atom(get => {
    const root = get(this.root)
    return root ? get(root.isMedia) : false
  })

  canUpload = atom(get => {
    const location = get(this.location)
    const policy = get(this.dashboard.policy)
    return policy.canUpload({
      workspace: location.workspace,
      root: location.root,
      id: location.parentId
    })
  })

  uploadsInCurrentFolder = atom(get => {
    const location = get(this.location)
    const queue = get(this.dashboard.mutationQueue)
    return queue.entries.filter(entry => {
      if (!entry.upload) return false
      if (!entry.mutations.some(mutation => mutation.op === 'uploadFile'))
        return false
      return (
        entry.upload.workspace === location.workspace &&
        entry.upload.root === location.root &&
        (entry.upload.parentId ?? null) === (location.parentId ?? null)
      )
    })
  })

  upload = atom(null, async (get, set, files: DashboardUploadFiles) => {
    const location = get(this.location)
    const db = get(this.dashboard.db)
    const policy = get(this.dashboard.policy)
    policy.assert(Permission.Upload, {
      workspace: location.workspace,
      root: location.root,
      id: location.parentId
    })
    const uploadFiles = Array.from(files)
    if (uploadFiles.length === 0) return
    const ops = uploadFiles.map(file => {
      const op = new UploadOperation({
        file,
        createPreview: createPreview,
        parentId: location.parentId,
        workspace: location.workspace,
        root: location.root,
        onProgress: progress => {
          set(this.dashboard.uploadProgress, {
            type: 'progress',
            id: op.id,
            progress
          })
        }
      })
      return op
    })
    const uploads = uploadFiles.map((file, index) => ({
      id: ops[index]!.id,
      file
    }))
    const ids = uploads.map(upload => upload.id)
    set(this.dashboard.uploadProgress, {
      type: 'start',
      uploads,
      destination: {
        workspace: location.workspace,
        root: location.root,
        parentId: location.parentId
      }
    })
    try {
      await db.commit(...ops)
    } finally {
      set(this.dashboard.uploadProgress, {type: 'finish', ids})
    }
  })

  workspace = atom(
    get => {
      const {workspace} = get(this.location)
      return this.dashboard.workspace(workspace)
    },
    (get, set, update: string) => {
      const roots = get(this.dashboard.workspace(update).roots)
      assert(roots[0], `No readable roots found for workspace "${update}"`)
      set(this.location, {workspace: update, root: roots[0]})
    }
  )

  root = atom(
    get => {
      const {root} = get(this.location)
      if (!root) return
      const workspace = get(this.workspace)
      return workspace.root(root)
    },
    (get, set, update: string) => {
      const workspace = get(this.workspace)
      set(this.location, {workspace: workspace.key, root: update})
    }
  )

  parent = atom(
    get => {
      const {parentId} = get(this.location)
      if (!parentId) return
      return this.dashboard.entries(parentId)
    },
    (get, set, parentId: string | undefined) => {
      const location = get(this.location)
      set(this.location, {...location, parentId})
    }
  )

  items = atomWithPending(
    atom(async get => {
      get(this.dashboard.sha) // subscribe to content changes, todo: refine
      const location = get(this.location)
      const db = get(this.dashboard.db)
      const search = get(this.search)
      const root = get(this.root)
      const sort = get(this.sort)
      const filter = get(this.filter)
      const fieldMap: Record<ExplorerSortBy, Expr<string | number>> = {
        title: Entry.title,
        path: Entry.path,
        size: MediaFile.size,
        id: Entry.id
      }
      const fieldToSort = fieldMap[sort.sortBy]
      const orderBy = {
        [sort.direction]: fieldToSort,
        caseSensitive: fieldToSort !== Entry.id
      }
      if (!root) return []
      const locale = get(root.selectedLocale)
      const searchAll = Boolean(search && this.#options.searchDepth === 'all')
      const flatList = Boolean(this.#options.condition) || searchAll
      const policy = get(this.dashboard.policy)
      const children = await db.find({
        locale,
        search: search || undefined,
        workspace: location.workspace,
        root: location.root,
        parentId: flatList ? undefined : (location.parentId ?? null),
        filter: this.#options.condition,
        select: {
          id: Entry.id,
          type: Entry.type,
          workspace: Entry.workspace,
          root: Entry.root,
          parents: Entry.parents,
          locale: Entry.locale
        },
        orderBy,
        status: 'preferDraft',
        type: filter
      })
      return Promise.all(
        children
          .filter(child => policy.canRead(child))
          .map(child => this.dashboard.entries(child.id))
      )
    })
  )

  parentsMenu = unwrap(
    atom(async get => {
      const {parentId} = get(this.location)
      if (!parentId) return []
      const parent = this.dashboard.entries(parentId)
      assert(parent, 'Parent entry not found')
      const [, parentData] = get(parent.data)
      if (!parentData) return []
      const parents = await get(parentData.parents)
      const label = get(parentData.label)
      return [
        ...parents
          .map(entry => get(entry.data)[1])
          .filter((entry): entry is DashboardEntryData => entry !== undefined)
          .map(entry => ({id: entry.id, label: get(entry.label)})),
        {id: parent.id, label}
      ]
    }),
    prev => prev ?? []
  )
}

export class DashboardField {
  value: WritableAtom<unknown, [unknown], void>

  constructor(
    public draft: DashboardEditor,
    public key: string,
    public field: Field
  ) {
    this.value = this.draft.node.field(key)
  }

  #getter = atom(get => {
    return ((field: Field) => {
      const info = this.draft.get(field)
      assert(info, `Field not found: ${Field.label(field)}`)
      return get(info.value)
    }) as FieldGetter
  })

  options = atom(get => {
    const defaultOptions = Field.options(this.field)
    const tracker = optionTrackerOf(this.field)
    const update = tracker ? tracker(get(this.#getter)) : undefined
    const options = {...defaultOptions, ...update}
    const resource = this.draft.resource
    if (!resource) return options
    const config = get(this.draft.dashboard.config)
    const fieldName = getScope(config).nameOf(this.field)
    if (!fieldName) return options
    const policy = get(this.draft.dashboard.policy)
    const fieldResource = {...resource, field: fieldName}
    return {
      ...options,
      hidden: options.hidden || !policy.canRead(fieldResource),
      readOnly: options.readOnly || !policy.canUpdate(fieldResource)
    }
  })

  error = atom((get): string | undefined => {
    const options = get(this.options) as FieldOptions<unknown>
    const value = get(this.value)
    if (options.validate) {
      const result = options.validate(value)
      if (typeof result === 'boolean')
        return result ? 'Field is invalid' : undefined
      return result
    }
    if (options.required) {
      if (value === undefined || value === null) return 'Field is required'
      if (typeof value === 'string' && value === '') return 'Field is required'
      if (Array.isArray(value) && value.length === 0) return 'Field is required'
    }
    return undefined
  })

  view = atom(get => {
    const view = Field.view(this.field)
    if (typeof view === 'string') return get(this.draft.dashboard.view(view))
    return view
  })
}

export class DashboardType {
  constructor(
    public dashboard: Dashboard,
    public type: Type
  ) {}

  get contains() {
    return getType(this.type).contains
  }
  get label() {
    return getType(this.type).label
  }
  get orderChildrenBy() {
    return getType(this.type).orderChildrenBy
  }
  get icon() {
    return getType(this.type).icon
  }
  get sections() {
    return getType(this.type).sections
  }
}

export class DashboardWorkspace {
  constructor(
    public dashboard: Dashboard,
    public key: string
  ) {}

  #treeSelection = atom(
    get => {
      const route = get(this.dashboard.route)
      if (route.workspace && route.workspace !== this.key) return new Set<Key>()
      if (route.entry) return new Set<Key>([route.entry])
      return new Set<Key>()
    },
    async (get, set, next: 'all' | Set<Key>) => {
      if (next === 'all')
        throw new Error('Selecting all items is not supported')
      const current = get(this.dashboard.route)
      const root = get(this.dashboard.selectedRoot)
      const selectedKey = next.values().next().value
      if (!selectedKey) {
        set(this.dashboard.route, {workspace: this.key})
        return
      }
      const selectedId = String(selectedKey)
      set(this.dashboard.route, {
        workspace: this.key,
        root: root ?? undefined,
        entry: selectedId,
        locale: current.locale
      })
    }
  )

  tree = new DashboardTree(this, this.#treeSelection)

  #settings = atom(get => {
    const config = get(this.dashboard.config)
    const workspaceConfig = config.workspaces[this.key]
    assert(workspaceConfig, `Workspace "${this.key}" not found in config`)
    return getWorkspace(workspaceConfig)
  })

  color = atom(get => get(this.#settings).color)
  label = atom(get => get(this.#settings).label)
  icon = atom(get => get(this.#settings).icon)

  roots = atom(get => {
    const roots = get(this.#settings).roots
    const policy = get(this.dashboard.policy)
    return Object.keys(roots).filter(root => {
      return policy.canRead({workspace: this.key, root})
    })
  })

  root = dispense(key => new DashboardRoot(this, key))

  rootMenu = atom(get => {
    const roots = get(this.roots)
    return roots.map(root => ({
      id: root,
      label: get(this.root(root).label),
      icon: get(this.root(root).icon)
    }))
  })
}

export class DashboardTree {
  #treeSelection: DashboardTreeSelection
  constructor(
    private workspace: DashboardWorkspace,
    treeSelection: DashboardTreeSelection
  ) {
    this.#treeSelection = treeSelection
  }

  #routeExpandedKeys = atom(async get => {
    const route = get(this.workspace.dashboard.route)
    if (!route.entry || route.workspace !== this.workspace.key)
      return new Set<Key>()
    const entry = this.workspace.dashboard.entries(route.entry)
    const [, data] = get(entry.data)
    if (!data) return new Set<Key>()
    return new Set<Key>(get(data.parentIds))
  })

  expandedKeys = Object.assign(
    atom(
      get => get(this.#expandedKeys),
      (get, set, next: 'init' | Set<Key>) => {
        startTransition(() => {
          if (next === 'init') {
            get(this.#routeExpandedKeys).then(routeKeys => {
              if (routeKeys.size === 0) return
              const current = get(this.#expandedKeys)
              const merged = new Set(current)
              for (const key of routeKeys) merged.add(key)
              set(this.#expandedKeys, merged)
            })
          } else {
            set(this.#expandedKeys, next)
          }
        })
      }
    ),
    {onMount: (setSelf: (value: 'init') => void) => setSelf('init')}
  )
  #expandedKeys = atom(new Set<Key>())

  selectedKeys = atom(
    get => get(this.#treeSelection),
    (get, set, next: 'all' | Set<Key>) => {
      startTransition(() => {
        assert(next !== 'all', 'Selecting all items is not supported')
        const [first] = next
        if (first) {
          const expandedKeys = get(this.#expandedKeys)
          if (!expandedKeys.has(first))
            set(this.#expandedKeys, new Set(expandedKeys).add(first))
        }
        set(this.#treeSelection, next)
      })
    }
  )

  entryItems = dispense((id: string): DashboardEntry => {
    return this.workspace.dashboard.entries(id)
  })

  items = swr(
    atom(async get => {
      const currentRoot = get(this.workspace.dashboard.currentRoot)
      if (!currentRoot || currentRoot.workspace.key !== this.workspace.key)
        return []
      const ids = await get(currentRoot.children)
      return ids.map(id => this.entryItems(id))
    })
  )

  isExpanded = dispense((entry: DashboardEntry) => {
    return atom(get => get(this.expandedKeys).has(entry.id))
  })

  selectedAncestorStatus = dispense((entry: DashboardEntry) => {
    return atom(
      async (get): Promise<DashboardEntryTreeStatus | undefined> => {
        const [, data] = get(entry.data)
        if (!data) return undefined
        const selectedKey = get(this.selectedKeys).values().next().value
        if (!selectedKey) return undefined
        const selectedId = String(selectedKey)
        if (selectedId === entry.id) return undefined
        if (!get(data.parentIds).includes(selectedId)) return undefined
        const selected = this.entryItems(selectedId)
        const [, selectedData] = get(selected.data)
        if (!selectedData) return undefined
        return get(selectedData.treeStatus)
      }
    )
  })

  children = dispense((entry: DashboardEntry) => {
    return atom(get => {
      const [, data] = get(entry.data)
      if (!data) return undefined
      if (!get(data.hasChildren)) return undefined
      if (!get(this.isExpanded(entry))) return undefined
      const children = get(unwrap(data.children))
      return children?.map(childId => this.entryItems(childId))
    })
  })

  // dnd
  acceptedDragTypes = [DASHBOARD_ENTRY_DRAG_TYPE, 'text/plain']

  getItems = atom(null, (get, set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(id => dragItem(id))
  })

  dragDisabled = atom(get => {
    const currentRoot = get(this.workspace.dashboard.currentRoot)
    if (!currentRoot) return true
    const policy = get(this.workspace.dashboard.policy)
    const resource = {workspace: this.workspace.key, root: currentRoot.key}
    return !policy.canMove(resource) && !policy.canReorder(resource)
  })

  getDropOperation = atom(
    null,
    (
      get,
      set,
      _target: DropTarget,
      types: DragTypes,
      allowedOperations: Array<DropOperation>
    ) => {
      if (!acceptsDashboardEntryDrag(types)) return 'cancel'
      return allowedOperations.includes('move') ? 'move' : 'cancel'
    }
  )

  onMove = atom(
    null,
    async (get, set, event: DroppableCollectionReorderEvent) => {
      await this.#moveDraggedKeys(get, event.keys, event.target)
    }
  )

  onInsert = atom(
    null,
    async (get, set, event: DroppableCollectionInsertDropEvent) => {
      await this.#moveDropItems(get, event.items, event.target)
    }
  )

  onItemDrop = atom(
    null,
    async (get, set, event: DroppableCollectionOnItemDropEvent) => {
      await this.#moveDropItems(get, event.items, event.target)
    }
  )

  async #moveDraggedKeys(get: Getter, keys: Set<Key>, target: ItemDropTarget) {
    const db = get(this.workspace.dashboard.db)
    const policy = get(this.workspace.dashboard.policy)
    const selectedRoot = get(this.workspace.dashboard.selectedRoot)
    if (!selectedRoot) return
    const {moveTarget, targetType} = this.#target(target.key, selectedRoot)
    for (const key of keys) {
      const draggedId = String(key)
      const entry = this.workspace.dashboard.entries(draggedId)
      const [, data] = get(entry.data)
      assert(data, `Entry "${draggedId}" is not loaded`)
      const [resource] = get(data.entryData).entries
      const permission =
        target.dropPosition === 'on' ? Permission.Move : Permission.Reorder
      policy.assert(permission, resource)
      await db.move({
        id: draggedId,
        target: moveTarget,
        targetType,
        dropPosition: target.dropPosition
      })
    }
  }

  async #moveDropItems(
    get: Getter,
    items: Array<DropItem>,
    target: ItemDropTarget
  ) {
    const draggedKeys = new Set<Key>()
    for (const item of items) {
      if (item.kind !== 'text' || !item.types || !item.getText) continue
      let draggedId: string | null = null
      if (item.types.has(DASHBOARD_ENTRY_DRAG_TYPE)) {
        draggedId = await item.getText(DASHBOARD_ENTRY_DRAG_TYPE)
      } else if (item.types.has('text/plain')) {
        draggedId = await item.getText('text/plain')
      }
      if (!draggedId) continue
      draggedKeys.add(draggedId)
    }
    await this.#moveDraggedKeys(get, draggedKeys, target)
  }

  #target(key: Key | undefined, selectedRoot: string) {
    if (!key) {
      return {
        moveTarget: selectedRoot,
        targetType: 'root'
      } as const
    }
    const targetId = String(key)
    return {
      moveTarget: targetId,
      targetType: 'entry'
    } as const
  }

  visibleTypes = atom(get => {
    const config = get(this.workspace.dashboard.config)
    return Object.entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
  })
}

interface EntryVersionData {
  id: string
  type: string
  title: string
  status: EntryStatus
  locale: string | null
  main: boolean
  path: string
  parentId: string | null
  parents: Array<string>
  seeded: string | null
  workspace: string
  root: string
  url: string
  data: Record<string, unknown>
  fileHash: string
  filePath: string
}

interface EntryData {
  id: string
  type: string
  parentId: string | null
  workspace: string
  root: string
  hasChildren: boolean
  parents: Array<{
    id: string
    path: string
    type: string
    status: EntryStatus
    main: boolean
  }>
  entries: Array<EntryVersionData>
}

export interface DashboardEntryTreeStatus {
  status: EntryStatus | 'unpublished' | 'untranslated'
}

type SelectedVersion =
  | {type: 'status'; status: EntryStatus}
  | {type: 'history'; file: string; ref: string}

export class DashboardEntry {
  data: Atom<
    readonly [pending: boolean, data: DashboardEntryData | undefined]
  >

  constructor(
    public dashboard: Dashboard,
    public id: string
  ) {
    const entryData = atom<Promise<EntryData>>(async get => {
      await get(this.dashboard.ensureInitialSync)
      get(this.dashboard.revisions(id))
      const load = get(this.dashboard.entryLoader)
      const [result, error] = await load(id)
      if (error) {
        if (error instanceof MissingEntryError) get(this.dashboard.sha) // subscribe to entry revisions to update when entry synced
        throw error
      }
      assert(result, `Entry "${id}" not found`)
      return result
    })
    let data: DashboardEntryData
    const loaded = atom(async get => {
      const initial = await get(entryData)
      return (data ??= new DashboardEntryData(
        this,
        unwrap(entryData, prev => prev ?? initial) as Atom<EntryData>
      ))
    })
    this.data = atomWithPending(loaded)
  }
}

export class DashboardEntryData {
  workspaceKey: Atom<string>
  rootKey: Atom<string>
  hasChildren: Atom<boolean>
  type: Atom<DashboardType>
  locales: Atom<Map<string | null, EntryVersionData>>
  parentId: Atom<string | null>
  parentIds: Atom<Array<string>>
  root: Atom<DashboardRoot>
  #translationSourceLocale = atom<string | null | undefined>(undefined)

  constructor(
    public entry: DashboardEntry,
    public entryData: Atom<EntryData>
  ) {
    const dashboard = entry.dashboard
    const id = entry.id
    const data = this.entryData
    this.workspaceKey = atom(get => get(data).workspace)
    this.rootKey = atom(get => get(data).root)
    this.hasChildren = atom(get => get(data).hasChildren)
    this.type = atom(get => get(this.dashboard.type(get(data).type)))
    this.parentId = atom(get => get(data).parentId)
    this.parentIds = atom(get => get(data).parents.map(parent => parent.id))
    this.locales = atom(
      get =>
        new Map(
          get(data).entries.map(entry => {
            return [entry.locale, entry] as const
          })
        )
    )
    this.root = atom(get => {
      const workspace = get(this.workspaceKey)
      const root = get(this.rootKey)
      return dashboard.workspace(workspace).root(root)
    })
  }

  get dashboard() {
    return this.entry.dashboard
  }

  get id() {
    return this.entry.id
  }

  translationSourceLocales = atom(get => {
    return Array.from(get(this.locales).keys()).filter(
      (locale): locale is string => locale !== null
    )
  })

  translationSourceLocale = atom(
    get => {
      const locale = get(this.#translationSourceLocale)
      const available = get(this.translationSourceLocales)
      if (locale && available.includes(locale)) return locale
      return available[0] ?? null
    },
    (get, set, locale: string) => {
      if (get(this.#translationSourceLocale) === locale) return
      startTransition(() => {
        set(this.#translationSourceLocale, locale)
        set(this.currentlyEditing, undefined)
        set(this.#selection, undefined)
      })
    }
  )

  sourceLocale = atom(get => {
    if (get(this.untranslated)) return get(this.translationSourceLocale)
    return get(get(this.root).selectedLocale)
  })

  activeStatus = atom(get => {
    const locales = get(this.locales)
    const locale = get(this.sourceLocale)
    const entry = locales.get(locale)
    assert(entry, `Entry ${this.id} has no data for locale ${locale}`)
    return entry.status
  })

  #selection = atom<SelectedVersion>()
  selectedVersion = atom(
    (get): SelectedVersion => {
      const current = get(this.#selection)
      if (current) return current
      const status = get(this.activeStatus)
      return {type: 'status', status}
    },
    (get, set, next: SelectedVersion) => {
      startTransition(() => {
        set(this.#selection, next)
      })
    }
  )

  #historyFile = atom(get => {
    const config = get(this.dashboard.config)
    const locale = get(this.sourceLocale)
    const data = get(this.locales).get(locale)
    assert(data, `No locale data found for locale ${locale}`)
    return dashboardEntryFile(config, {
      workspace: get(this.workspaceKey),
      root: get(this.rootKey),
      filePath: data.filePath
    })
  })

  history = unwrap(
    atom(async (get): Promise<Array<Revision>> => {
      const file = get(this.#historyFile)
      const client = get(this.dashboard.client)
      const revisions = await client.revisions(file)
      // Sort revisions by date
      revisions.sort((a, b) => b.createdAt - a.createdAt)
      return revisions.slice(1)
    })
  )

  historyData = dispense((key: string) => {
    return atom(async get => {
      const [ref, file] = parseHistoryDataKey(key)
      const client = get(this.dashboard.client)
      return client.revisionData(file, ref)
    })
  })

  selectedNode = swr(
    atom(async (get): Promise<ReactiveNode<object>> => {
      const version = get(this.selectedVersion)
      if (version.type === 'status') {
        const untranslated = get(this.untranslated)
        const locale = get(this.sourceLocale)
        const language = this.languages(locale)
        const versions = await get(language.versions)
        const status = versions.has(version.status)
          ? version.status
          : versions.keys().next().value
        assert(
          status,
          `No versions found for entry ${this.id} and locale ${locale}`
        )
        if (status === get(this.activeStatus)) {
          const editing = get(this.currentlyEditing)
          if (editing) return editing
        }
        if (untranslated) {
          const sourceNode = await get(language.data(status))
          const sourceValue = get(sourceNode.value) as Record<string, unknown>
          return new ReactiveNode<object>({
            ...sourceValue,
            path: undefined
          })
        }
        return get(language.data(status))
      }
      const locale = get(this.sourceLocale)
      const language = this.languages(locale)
      const activeVersion = await get(language.activeVersion)
      const data = await get(this.historyData(historyDataKey(version)))
      const type = get(this.type).type
      const historyData = data ? parseRecord(data).data : activeVersion.data
      return new ReactiveNode<object>(
        {
          ...Type.initialValue(type),
          ...historyData,
          title:
            typeof historyData.title === 'string'
              ? historyData.title
              : activeVersion.title,
          path:
            typeof historyData.path === 'string'
              ? historyData.path
              : activeVersion.path
        },
        true
      )
    })
  )

  label = atom(get => {
    const locale = get(this.sourceLocale)
    const locales = get(this.locales)
    const entry = locales.get(locale)
    if (entry?.title) return entry.title
    for (const fallback of locales.values()) {
      if (fallback.title) return fallback.title
    }
    return ''
  })

  treeStatus = atom((get): DashboardEntryTreeStatus => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    const locales = get(this.locales)
    const localized = locales.get(locale)
    const fallback = locales.values().next().value
    const entry = localized ?? fallback
    assert(entry, `Entry ${this.id} has no versions`)
    if (localized === undefined) return {status: 'untranslated'}
    if (entry.status === 'draft' && entry.main === true)
      return {status: 'unpublished'}
    return {
      status: entry.status
    }
  })

  fileInfo = swr(
    atom(async (get): Promise<Infer<typeof MediaFile> | null> => {
      if (get(this.type).type !== MediaFile) return null
      const lang = this.languages(null)
      const data = await get(lang.activeVersion)
      return data.data as Infer<typeof MediaFile>
    })
  )

  #parents = atom(async get => {
    const parentIds = get(this.parentIds)
    return Promise.all(
      parentIds.map(async id => {
        const parent = this.dashboard.entries(id)
        assert(parent, `Parent entry not found: ${id}`)
        return parent
      })
    )
  })

  parentsState = atomWithPending(this.#parents)

  parents = swr(this.#parents)

  canPublish = atom(get => {
    return get(this.parentInfo).every(parent => parent.status === 'published')
  })

  parentUnpublished = atom(get => {
    return get(this.parentInfo).some(parent => parent.status === 'draft')
  })

  parentInfo = atom(get => {
    return get(this.entryData).parents
  })

  icon = atom(get => get(this.type).icon)

  children = swr(
    atom(async get => {
      const root = get(this.root)
      const orderChildrenBy = atom(get => get(this.type).orderChildrenBy)
      return queryTreeChildren(get, root, this.id, orderChildrenBy)
    })
  )

  untranslated = atom(get => {
    const root = get(this.root)
    const locales = get(this.locales)
    const locale = get(root.selectedLocale)
    return !locales.has(locale)
  })

  availableStatuses = swr(
    atom(async get => {
      const locale = get(this.sourceLocale)
      const language = this.languages(locale)
      const versions = await get(language.versions)
      return [...versions.keys()]
    })
  )

  activeVersion = swr(
    atom(async get => {
      const locales = get(this.locales)
      const locale = get(this.sourceLocale)
      const entry = locales.get(locale)
      if (entry) return entry
      for (const fallback of locales.values()) {
        if (fallback.title) return fallback
      }
      return null
    })
  )

  parentNeedsTranslation = swr(
    atom(async get => {
      if (!get(this.untranslated)) return false
      const parentId = get(this.parentId)
      if (!parentId) return false
      const locale = get(get(this.root).selectedLocale)
      if (!locale) return false
      const db = get(this.dashboard.db)
      const parentLink = await db.first({
        select: Entry.id,
        id: parentId,
        locale,
        status: 'preferDraft'
      })
      return !parentLink
    })
  )

  preview = atom(get => {
    const type = get(this.type).type
    const typePreview = Type.preview(type)
    if (typePreview !== undefined) return typePreview
    const config = get(this.dashboard.config)
    const workspace = config.workspaces[get(this.workspaceKey)]
    if (!workspace) return config.preview
    const root = workspace[get(this.rootKey)]
    return (
      (root ? getRoot(root).preview : undefined) ??
      getWorkspace(workspace).preview ??
      config.preview
    )
  })

  hasPreview = atom(get => Boolean(get(this.preview)))

  #previewRetry = atom(0)

  retryPreviewUrl = atom(null, (get, set) => {
    set(this.#previewRetry, current => current + 1)
  })

  previewEntry = swr(
    atom(async get => {
      if (!get(this.hasPreview)) return null
      const locale = get(get(this.root).selectedLocale)
      const language = this.languages(locale)
      const activeVersion = await get(language.activeVersion)
      const node = await get(this.selectedNode)
      const value = get(node.value)
      if (!isObject<Record<string, unknown>>(value)) return activeVersion
      const title =
        typeof value.title === 'string' ? value.title : activeVersion.title
      const path =
        typeof value.path === 'string' ? value.path : activeVersion.path
      return {
        ...activeVersion,
        title,
        path,
        data: value
      }
    })
  )

  #previewPayloadSignal = atom(get => {
    if (get(this.preview) !== true) return undefined
    const selected = get(this.selectedVersion)
    const currentNode = get(this.currentlyEditing)
    const selectedKey =
      selected.type === 'status' ? selected.status : selected.ref
    return [selected.type, selectedKey, currentNode && get(currentNode.value)]
  })
  previewPayloadSignal = atomWithDebounce(this.#previewPayloadSignal, 250)

  updatePreviewPayload = atom(null, async get => {
    if (get(this.preview) !== true) return undefined
    const node = await get(this.selectedNode)
    const value = get(node.value)
    if (!isObject<Record<string, unknown>>(value)) return undefined
    const sha = get(this.dashboard.sha)
    if (!sha) return undefined

    const root = get(this.root)
    const locale = get(root.selectedLocale)
    const activeVersion = await get(this.languages(locale).activeVersion)
    if (!activeVersion) return undefined
    const selected = get(this.selectedVersion)
    const status =
      selected.type === 'status' ? selected.status : activeVersion.status

    const nextTitle =
      typeof value.title === 'string' ? value.title : activeVersion.title
    const nextPath =
      typeof value.path === 'string' ? value.path : activeVersion.path
    const nextVersion = {
      ...activeVersion,
      title: nextTitle,
      path: nextPath,
      data: value,
      status
    }
    const schema = get(this.dashboard.config).schema
    const baseText = decoder.decode(
      JsonLoader.format(
        schema,
        createRecord(activeVersion, activeVersion.status)
      )
    )
    const nextText = decoder.decode(
      JsonLoader.format(schema, createRecord(nextVersion, status))
    )
    const patch = await createFilePatch(baseText, nextText)
    return encodePreviewPayload({
      locale: activeVersion.locale,
      entryId: activeVersion.id,
      contentHash: sha,
      status,
      patch
    })
  })

  previewUrl = atom(async get => {
    if (get(this.preview) !== true) return undefined
    get(this.#previewRetry)
    const client = get(this.dashboard.client)
    if (!client || typeof client.previewToken !== 'function') return undefined
    const config = get(this.dashboard.config)
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    const activeVersion = await get(this.languages(locale).activeVersion)
    if (!activeVersion) return undefined
    try {
      const previewToken = await client.previewToken({url: activeVersion.url})
      const base = new URL(
        config.handlerUrl ?? '',
        Config.baseUrl(config) ??
          (typeof location === 'undefined' ? 'http://localhost' : location.href)
      )
      return new URL(`?preview=${previewToken}`, base).toString()
    } catch {
      return undefined
    }
  })

  languages = dispense((locale: string | null) => {
    return new DashboardEntryLanguage(this, locale)
  })

  routeBlock = atom<{confirm: () => void} | null>(null)

  needsBlock = atom(null, (get, set, confirm: () => void): boolean => {
    const currentNode = get(this.currentlyEditing)
    if (!currentNode) return false
    const isDirty = get(currentNode.isDirty)
    if (isDirty)
      set(this.routeBlock, {
        confirm: () => {
          set(this.routeBlock, null)
          confirm()
        }
      })
    return isDirty
  })

  currentlyEditing = atom<ReactiveNode<object>>()

  async #assertPermission(
    get: Getter,
    permission: Permission,
    locale: string | null
  ) {
    const activeVersion = await get(this.languages(locale).activeVersion)
    get(this.dashboard.policy).assert(permission, activeVersion)
    return activeVersion
  }

  saveDraft = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Update, locale)
    const data = get(node.value)
    const db = get(this.dashboard.db)
    const type = get(this.type).type
    await db.create({
      type,
      id: this.id,
      locale: locale,
      status: 'draft',
      set: data,
      overwrite: true
    })
    set(node.commit)
  })

  publishEdits = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const data = get(node.value)
    const db = get(this.dashboard.db)
    const type = get(this.type).type
    await db.create({
      type,
      id: this.id,
      locale,
      status: 'published',
      set: data,
      overwrite: true
    })
    set(node.commit)
  })

  publishDraft = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(this.dashboard.db)
    await db.publish({
      id: this.id,
      locale,
      status: 'draft'
    })
  })

  discardDraft = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Update, locale)
    const db = get(this.dashboard.db)
    await db.discard({
      id: this.id,
      locale,
      status: 'draft'
    })
  })

  unpublish = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(this.dashboard.db)
    await db.unpublish({
      id: this.id,
      locale
    })
  })

  archive = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Archive, locale)
    const db = get(this.dashboard.db)
    await db.archive({
      id: this.id,
      locale
    })
  })

  publishArchived = atom(null, async (get, set) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Publish, locale)
    const db = get(this.dashboard.db)
    await db.publish({
      id: this.id,
      locale,
      status: 'archived'
    })
  })

  deleteEntry = atom(null, async get => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    await this.#assertPermission(get, Permission.Delete, locale)
    const db = get(this.dashboard.db)
    await db.remove(this.id)
  })

  replaceFile = atom(null, async (get, set, file: File) => {
    const locale = get(this.sourceLocale)
    const activeVersion = await get(this.languages(locale).activeVersion)
    const policy = get(this.dashboard.policy)
    policy.assert(Permission.Update, activeVersion)
    policy.assert(Permission.Upload, activeVersion)
    const db = get(this.dashboard.db)
    await db.commit(
      new UploadOperation({
        file,
        createPreview,
        replaceId: this.id,
        parentId: activeVersion.parentId,
        workspace: activeVersion.workspace,
        root: activeVersion.root
      })
    )
  })

  saveTranslation = atom(null, async (get, set, node: ReactiveNode<object>) => {
    const root = get(this.root)
    const locale = get(root.selectedLocale)
    assert(locale, `Cannot translate entry ${this.id} without a locale`)
    const sourceLocale = get(this.translationSourceLocale)
    assert(
      sourceLocale,
      `Cannot translate entry ${this.id} without a source locale`
    )
    const activeVersion = await get(this.languages(sourceLocale).activeVersion)
    get(this.dashboard.policy).assert(Permission.Update, {
      ...activeVersion,
      locale
    })
    const parentId = activeVersion.parentId
    const db = get(this.dashboard.db)
    if (parentId) {
      const parentLink = await db.first({
        select: Entry.id,
        id: parentId,
        locale,
        status: 'preferDraft'
      })
      assert(parentLink, 'Parent not translated')
    }
    const config = get(this.dashboard.config)
    const type = get(this.type).type
    const data = get(node.value)
    await db.create({
      type,
      id: this.id,
      parentId,
      locale,
      status: config.enableDrafts ? 'draft' : 'published',
      set: data
    })
    set(node.commit)
  })
}

function historyDataKey(version: {file: string; ref: string}) {
  return `${version.ref}\0${version.file}`
}

function parseHistoryDataKey(key: string): [ref: string, file: string] {
  const index = key.indexOf('\0')
  assert(index !== -1, 'Invalid history data key')
  return [key.slice(0, index), key.slice(index + 1)]
}

function dashboardEntryFile(
  config: Config,
  entry: Pick<Entry, 'filePath' | 'root' | 'workspace'>
) {
  const workspace = config.workspaces[entry.workspace]
  assert(workspace, `Workspace "${entry.workspace}" does not exist`)
  const root = getWorkspace(workspace).roots[entry.root]
  assert(root, `Root "${entry.root}" does not exist`)
  return join(Config.contentDir(config), entry.filePath)
}

export class DashboardEntryLanguage {
  constructor(
    public entry: DashboardEntryData,
    public locale: string | null
  ) {}

  versions = swr(
    atom(async get => {
      get(this.entry.dashboard.revisions(this.entry.id)) // subscribe to entry changes
      const loader = get(this.entry.dashboard.versionLoader)
      const [entries] = await loader(this.entry.id)
      if (!entries)
        throw new Error(`No versions found for entry ${this.entry.id}`)
      const policy = get(this.entry.dashboard.policy)
      const readable = entries.filter(entry => {
        return entry.locale === this.locale && policy.canRead(entry)
      })
      // order by draft, published, archived
      const order = ['draft', 'published', 'archived']
      readable.sort((a, b) => {
        return order.indexOf(a.status) - order.indexOf(b.status)
      })
      return new Map(readable.map(entry => [entry.status, entry] as const))
    })
  )

  activeVersion = swr(
    atom(async get => {
      const versions = await get(this.versions)
      const first = versions.values().next().value
      assert(
        first,
        `No versions found for entry ${this.entry.id} and locale ${this.locale}`
      )
      return first
    })
  )

  data = dispense((status: EntryStatus) => {
    return atom(async get => {
      const type = get(this.entry.type).type
      const versions = await get(this.versions)
      const activeStatus = versions.keys().next().value
      const version = versions.get(status)
      assert(version, `No version found`)
      const data = version.data
      const policy = get(this.entry.dashboard.policy)
      // Todo: fix data during indexing instead of here
      const initialValue = {
        ...Type.initialValue(type),
        ...data
      }
      const isActiveVersion = status === activeStatus
      return new ReactiveNode(
        initialValue,
        !isActiveVersion || !policy.canUpdate(version)
      )
    })
  })
}

export class DashboardRoot {
  explorer: DashboardExplorer
  constructor(
    public workspace: DashboardWorkspace,
    public key: string
  ) {
    const parentId = atom<string | null | undefined>(undefined)
    const selectedParent = atom(get => {
      const route = get(this.workspace.dashboard.route)
      const selectedWorkspace = get(this.workspace.dashboard.selectedWorkspace)
      const selectedRoot = get(this.workspace.dashboard.selectedRoot)
      const selected = get(parentId)
      if (selected !== undefined) return selected ?? undefined
      if (
        route.entry &&
        selectedWorkspace === workspace.key &&
        selectedRoot === key
      )
        return route.entry
      return selected
    })
    this.explorer = new DashboardExplorer(
      workspace.dashboard,
      atom(
        get => {
          return {
            workspace: workspace.key,
            root: key,
            parentId: get(selectedParent)
          }
        },
        (get, set, update: SetStateAction<ExplorerLocation>) => {
          const next =
            typeof update === 'function'
              ? update(get(this.explorer.location))
              : update
          if (next.root !== key || next.workspace !== workspace.key) {
            set(workspace.dashboard.route, {
              workspace: next.workspace,
              root: next.root
            })
          } else {
            const route = get(workspace.dashboard.route)
            const selectedWorkspace = get(workspace.dashboard.selectedWorkspace)
            const selectedRoot = get(workspace.dashboard.selectedRoot)
            set(parentId, next.parentId ?? null)
            if (
              route.entry &&
              selectedWorkspace === workspace.key &&
              selectedRoot === key
            )
              set(workspace.dashboard.route, {
                workspace: workspace.key,
                root: key,
                entry: next.parentId,
                locale: route.locale
              })
            set(
              workspace.tree.expandedKeys,
              new Set(next.parentId ? [next.parentId] : [])
            )
          }
        }
      ),
      {
        selectionMode: 'multiple',
        selectionBehavior: 'replace',
        onAction: atom(null, (get, set, entry) => {
          const [, data] = get(entry.data)
          if (!data) return
          if (get(data.hasChildren))
            set(this.explorer.location, location => ({
              ...location,
              parentId: entry.id
            }))
          else {
            const entryParentId = get(data.parentId) ?? undefined
            set(parentId, entryParentId ?? null)
            set(this.workspace.dashboard.route, {
              workspace: this.workspace.key,
              root: this.key,
              entry: entry.id
            })
          }
        })
      }
    )
  }

  #settings = atom(get => {
    const config = get(this.workspace.dashboard.config)
    const workspaceConfig = config.workspaces[this.workspace.key]
    assert(
      workspaceConfig,
      `Workspace "${this.workspace.key}" not found in config`
    )
    const rootConfig = workspaceConfig[this.key]
    return getRoot(rootConfig)
  })

  selected = atom(
    get => {
      if (
        get(this.workspace.dashboard.selectedWorkspace) !== this.workspace.key
      )
        return false
      return get(this.workspace.dashboard.selectedRoot) === this.key
    },
    (get, set, value: boolean) => {
      set(
        this.workspace.dashboard.route,
        value ? {workspace: this.workspace.key, root: this.key} : {}
      )
    }
  )

  #languagePreference = atom<string>()
  selectedLocale = atom(
    get => {
      const route = get(this.workspace.dashboard.route)
      const i18n = get(this.i18n)
      if (route.locale && i18n?.locales.includes(route.locale))
        return route.locale
      const preference = get(this.#languagePreference)
      if (preference) return preference
      return i18n?.locales[0] ?? null
    },
    (get, set, locale: string) => {
      const route = get(this.workspace.dashboard.route)
      startTransition(() => {
        set(this.workspace.dashboard.route, {
          workspace: this.workspace.key,
          root: this.key,
          entry: route.entry,
          locale
        })
        set(this.#languagePreference, locale)
      })
    }
  )

  label = atom(get => get(this.#settings).label)
  icon = atom(get => get(this.#settings).icon ?? IcRoundDescription)
  i18n = atom(get => get(this.#settings).i18n)
  view = atom(get => get(this.#settings).view)
  orderChildrenBy = atom(get => get(this.#settings).orderChildrenBy)
  canCreate = atom(get => {
    const policy = get(this.workspace.dashboard.policy)
    return policy.canCreate({
      workspace: this.workspace.key,
      root: this.key
    })
  })
  children = atom(get =>
    queryTreeChildren(get, this, null, this.orderChildrenBy)
  )
  isMedia = atom(get => get(this.#settings).isMediaRoot)

  hasChildren = atom(async get => {
    const db = get(this.workspace.dashboard.db)
    const visibleTypes = get(this.workspace.tree.visibleTypes)
    const policy = get(this.workspace.dashboard.policy)
    const children = await db.find({
      workspace: this.workspace.key,
      root: this.key,
      parentId: null,
      filter: {_type: {in: visibleTypes}},
      select: {
        id: Entry.id,
        type: Entry.type,
        workspace: Entry.workspace,
        root: Entry.root,
        parents: Entry.parents,
        locale: Entry.locale
      },
      status: 'preferDraft'
    })
    return children.some(child => policy.canRead(child))
  })
}

async function queryTreeChildren(
  get: Getter,
  root: DashboardRoot,
  parentId: null | string,
  orderByAtom: Atom<Order | Array<Order> | undefined>
) {
  get(root.workspace.dashboard.sha) // subscribe to content changes
  const visibleTypes = get(root.workspace.tree.visibleTypes)
  const db = get(root.workspace.dashboard.db)
  const policy = get(root.workspace.dashboard.policy)
  const orderBy = get(orderByAtom)
  const locale = get(root.selectedLocale)
  const children = await db.find({
    select: {
      id: Entry.id,
      type: Entry.type,
      workspace: Entry.workspace,
      root: Entry.root,
      parents: Entry.parents,
      locale: Entry.locale
    },
    orderBy,
    workspace: root.workspace.key,
    root: root.key,
    parentId: parentId,
    filter: {
      _type: {in: visibleTypes}
    },
    status: 'preferDraft'
  })
  const readableChildren = children.filter(child => policy.canRead(child))
  const translatedChildren = new Set(
    readableChildren
      .filter(child => child.locale === locale)
      .map(child => child.id)
  )
  const untranslated = new Set()
  const orderedChildren = readableChildren.filter(child => {
    if (translatedChildren.has(child.id)) return child.locale === locale
    if (untranslated.has(child.id)) return false
    untranslated.add(child.id)
    return true
  })
  const ids = [...new Set(orderedChildren.map(child => child.id))]
  return ids
}

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

function dispense<Key = string, Value = unknown>(
  fn: (key: Key) => Value
): (key: Key) => Value {
  const values = new Map<Key, Value>()
  return function dispenseValue(key: Key) {
    if (!values.has(key)) values.set(key, fn(key))
    return values.get(key)!
  }
}

const DASHBOARD_ENTRY_DRAG_TYPE = 'application/x-alinea-entry-id'

function acceptsDashboardEntryDrag(types: DragTypes) {
  return types.has(DASHBOARD_ENTRY_DRAG_TYPE) || types.has('text/plain')
}

function dragItem(id: Key): DragItem {
  const key = String(id)
  return {
    'text/plain': key,
    [DASHBOARD_ENTRY_DRAG_TYPE]: key
  }
}

function swr<Value>(asyncAtom: Atom<Promise<Value>>) {
  const withPrev = unwrap(asyncAtom, prev => prev)
  return atom(get => {
    const current = get(withPrev)
    return current ?? get(asyncAtom)
  })
}

function isPromiseLike<Value>(
  value: Value | PromiseLike<Value>
): value is PromiseLike<Value> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
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

function atomWithDebounce<Value>(
  source: Atom<Value>,
  delayMilliseconds: number
): Atom<Value | undefined> {
  const debounced = atom(async get => {
    const value = get(source)
    await new Promise(resolve => setTimeout(resolve, delayMilliseconds))
    return value
  })
  return unwrap(debounced)
}

// data nodes

export type Writable<Value> = WritableAtom<Value, [SetStateAction<Value>], void>
export type Peek<Value> = WritableAtom<null, [], Value>

function isArray<Value = any>(input: unknown): input is Array<Value> {
  return Array.isArray(input)
}
function isObject<Value extends object>(input: unknown): input is Value {
  return input !== null && typeof input === 'object' && !isArray(input)
}
type ReactiveObject = Record<string, ReactiveNode>

export class ReactiveNode<Value = unknown> {
  #initialValue: Value
  readonly readOnly: boolean
  nodes: WritableAtom<unknown, [unknown], void>
  #inner = atom(get => {
    const nodes = get(this.nodes)
    if (isArray<ReactiveNode>(nodes)) return nodes
    if (isObject<ReactiveObject>(nodes)) return values(nodes)
    return []
  })
  value: Writable<Value>
  peek: Peek<Value> = atom(null, get => get(this.value))

  constructor(initialValue: Value, readOnly = false) {
    this.#initialValue = initialValue
    this.readOnly = readOnly
    this.nodes = atom(this.#wrap(initialValue))
    this.value = atom(this.#read, this.#write)
  }

  #read = (get: Getter) => {
    return this.#unwrap(get, get(this.nodes)) as Value
  }

  #write = (get: Getter, set: Setter, update: SetStateAction<Value>) => {
    if (this.readOnly) return
    const next =
      typeof update === 'function'
        ? (update as Function)(get(this.value))
        : update
    this.#reconcile(get, set, next)
    const isChanged = next === this.#initialValue
    set(this.#dirty, !isChanged)
  }

  isEmpty = atom(get => get(this.value) === undefined)
  #dirty = atom(false)
  isDirty = atom(
    (get): boolean => {
      const dirty = get(this.#dirty)
      if (dirty) return true
      return get(this.#inner).some(node => get(node.isDirty))
    },
    (get, set, value: false) => {
      const isDirty = get(this.isDirty)
      if (!isDirty) return
      set(this.#dirty, false)
      for (const node of get(this.#inner)) set(node.isDirty, false)
    }
  )

  #wrap(value: unknown): unknown {
    if (isArray(value))
      return value.map(i => new ReactiveNode(i, this.readOnly))
    if (isObject(value)) {
      return fromEntries(
        entries(value).map(([k, i]) => [k, new ReactiveNode(i, this.readOnly)])
      )
    }
    return value
  }

  #unwrap(get: Getter, nodes: unknown): unknown {
    if (isArray<ReactiveNode>(nodes)) return nodes.map(node => get(node.value))
    if (isObject<ReactiveObject>(nodes)) {
      return fromEntries(entries(nodes).map(([k, n]) => [k, get(n.value)]))
    }
    return nodes
  }

  #reconcile(get: Getter, set: Setter, next: unknown) {
    const curr = get(this.nodes)

    if (isArray(next) && isArray(curr)) {
      let changed = curr.length !== next.length
      const nextStruct = []
      for (let i = 0; i < next.length; i++) {
        const val = next[i]
        if (curr[i]) {
          set((curr[i] as ReactiveNode).value, val)
          nextStruct.push(curr[i])
        } else {
          changed = true
          nextStruct.push(new ReactiveNode(val, this.readOnly))
        }
      }
      if (changed) set(this.nodes, nextStruct)
    } else if (isObject<any>(next) && isObject<any>(curr)) {
      let changed = false
      const nextStruct = {...curr} as Record<string, ReactiveNode>
      for (const key of Object.keys(curr)) {
        if (!(key in next)) {
          delete nextStruct[key]
          changed = true
        } else {
          set((curr[key] as ReactiveNode).value, next[key])
        }
      }
      for (const key of Object.keys(next)) {
        if (!curr[key]) {
          changed = true
          nextStruct[key] = new ReactiveNode(next[key], this.readOnly)
        }
      }
      if (changed) set(this.nodes, nextStruct)
    } else if (curr !== next) {
      set(this.nodes, this.#wrap(next))
    }
  }

  reset = atom(null, (get, set): void => {
    set(this.value, this.#initialValue)
    set(this.isDirty, false)
  })

  commit = atom(null, (get, set): Value => {
    for (const node of get(this.#inner)) set(node.commit)
    this.#initialValue = get(this.value)
    set(this.#dirty, false)
    return this.#initialValue
  })

  field = dispense((key: string): Writable<unknown> => {
    return atom(
      get => {
        const structure = get(this.nodes)
        return isObject<any>(structure) && structure[key]
          ? get((structure[key] as ReactiveNode).value)
          : undefined
      },
      (get, set, update) => {
        const structure = get(this.nodes)
        if (isObject<any>(structure) && structure[key])
          set((structure[key] as ReactiveNode).value, update)
      }
    )
  })

  push = atom(null, (get, set, val: unknown) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    set(this.nodes, [...structure, new ReactiveNode(val, this.readOnly)])
    set(this.#dirty, true)
  })

  insert = atom(null, (get, set, index: number, val: unknown) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    const next = [...structure]
    const insertAt = Math.max(0, Math.min(index, next.length))
    next.splice(insertAt, 0, new ReactiveNode(val, this.readOnly))
    set(this.nodes, next)
    set(this.#dirty, true)
  })

  remove = atom(null, (get, set, i: number) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    set(
      this.nodes,
      structure.filter((_, idx) => idx !== i)
    )
    set(this.#dirty, true)
  })

  move = atom(null, (get, set, from: number, to: number) => {
    if (this.readOnly) return
    const structure = get(this.nodes)
    if (!isArray(structure)) return
    const next = [...structure]
    next.splice(to, 0, next.splice(from, 1)[0])
    set(this.nodes, next)
    set(this.#dirty, true)
  })
}

const decoder = new TextDecoder()

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
