import {Entry} from '#/core/Entry.js'
import type {Order} from '#/core/Graph.js'
import {getRoot} from '#/core/Internal.js'
import {Root, type RootData, type RootI18n} from '#/core/Root.js'
import {assert} from '#/core/util/Assert.js'
import type {Atom, Getter} from 'jotai'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {SetStateAction, ComponentType} from 'react'
import {LucideFile} from '../icons.js'
import type {DashboardWorkspace} from './Workspace.js'
import {DashboardExplorer, type ExplorerLocation} from './Explorer.js'
import {dispense} from './StoreUtils.js'

const keepPreviousExplorerParent = new Promise<string | undefined>(() => {})

export class DashboardRoot {
  explorer: DashboardExplorer
  constructor(
    public workspace: DashboardWorkspace,
    public key: string
  ) {
    const selectedParent = unwrap(
      atom(get => {
        const route = get(this.workspace.dashboard.route)
        if (
          route.workspace === workspace.key &&
          route.root === key &&
          route.entry
        ) {
          const {data} = get(this.workspace.dashboard.entries(route.entry).data)
          if (data && get(data.view) === 'overview') return route.entry
          return keepPreviousExplorerParent
        }
        return undefined
      }),
      previous => previous
    )
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
            if (selectedWorkspace === workspace.key && selectedRoot === key)
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
        selectionBehavior: 'toggle',
        onAction: atom(null, (get, set, entry) => {
          set(this.workspace.dashboard.route, {
            workspace: this.workspace.key,
            root: this.key,
            entry: entry.id
          })
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
      const route = get(this.workspace.dashboard.route)
      if (route.page === 'users') return false
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
    async (get, set, locale: string) => {
      const route = get(this.workspace.dashboard.route)
      const changed = await set(this.workspace.dashboard.route, {
        workspace: this.workspace.key,
        root: this.key,
        entry: route.entry,
        locale
      })
      if (changed) {
        set(this.#languagePreference, locale)
      }
    }
  )

  label = atom(get => get(this.#settings).label)
  icon = atom(get => get(this.#settings).icon ?? LucideFile)
  i18n = atom(get => get(this.#settings).i18n)
  mediaI18n = atom((get): RootI18n | undefined => {
    return Root.mediaI18n(get(this.#settings))
  })
  data = atom((get): RootData & {name: string} => ({
    name: this.key,
    ...get(this.#settings)
  }))
  view = atom((get): ComponentType<{root: RootData}> | undefined => {
    const view = get(this.#settings).view
    if (!view) return undefined
    if (typeof view === 'string')
      return get(this.workspace.dashboard.view(view)) as
        | ComponentType<{root: RootData}>
        | undefined
    return view
  })
  orderChildrenBy = atom(get => get(this.#settings).orderChildrenBy)
  canCreate = atom(get => {
    const policy = get(this.workspace.dashboard.policy)
    return policy.canCreate({
      workspace: this.workspace.key,
      root: this.key
    })
  })
  childrenFor = dispense((locale: string | null) => {
    return atom(get =>
      queryTreeChildren(get, this, null, this.orderChildrenBy, locale)
    )
  })
  children = atom(get => get(this.childrenFor(get(this.selectedLocale))))
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

export async function queryTreeChildren(
  get: Getter,
  root: DashboardRoot,
  parentId: null | string,
  orderByAtom: Atom<Order | Array<Order> | undefined>,
  locale: string | null
) {
  get(root.workspace.dashboard.sha) // subscribe to content changes
  const visibleTypes = get(root.workspace.tree.visibleTypes)
  const db = get(root.workspace.dashboard.db)
  const policy = get(root.workspace.dashboard.policy)
  const orderBy = get(orderByAtom)
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
