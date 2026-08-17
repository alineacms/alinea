import {Entry, type EntryStatus} from '#/core/Entry.js'
import {Permission} from '#/core/Role.js'
import type {RootData, RootI18n} from '#/core/Root.js'
import {getRoot, getType, getWorkspace} from '#/core/Internal.js'
import {Type} from '#/core/Type.js'
import type {
  DragItem,
  DragTypes,
  DropOperation,
  DropTarget
} from '@react-types/shared'
import {
  createExplorerAtoms,
  type ExplorerAtoms
} from '#/dashboard/atoms/explorer.js'
import {type Atom, atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType} from 'react'
import type {
  DroppableCollectionInsertDropEvent,
  DroppableCollectionOnItemDropEvent,
  DroppableCollectionReorderEvent,
  Key
} from 'react-aria-components'
import {LucideFile} from '../icons.js'
import {viewAtoms} from './config.js'
import {configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'
import {policyAtom} from './user.js'
import {
  acceptsDashboardEntryDrag,
  dashboardEntryDragItem,
  dashboardEntryDragTypes,
  dispense
} from './utils.js'

export interface RootViewProps {
  root: RootData
}

export interface RootTreeItem {
  id: string
  title: string
  type: string
  status: EntryStatus
  main: boolean
  locale: string | null
  parentId: string | null
  parents: Array<string>
  hasChildren: boolean
  dragDisabled: boolean
}

export interface RootTreeNode {
  id: string
}

const rootTreeNode = dispense((id: string): RootTreeNode => ({id}))

const treeItemSelect = {
  id: Entry.id,
  title: Entry.title,
  type: Entry.type,
  status: Entry.status,
  main: Entry.main,
  locale: Entry.locale,
  parentId: Entry.parentId,
  parents: Entry.parents
}

function preferredLocaleEntries<
  Item extends {id: string; locale: string | null}
>(items: Array<Item>, locale: string | null): Array<Item> {
  const translated = new Set(
    items.filter(item => item.locale === locale).map(item => item.id)
  )
  const untranslated = new Set<string>()
  return items.filter(item => {
    if (translated.has(item.id)) return item.locale === locale
    if (untranslated.has(item.id)) return false
    untranslated.add(item.id)
    return true
  })
}

export class RootAtoms {
  readonly data: Atom<RootData>
  explorer: ExplorerAtoms

  constructor(
    public readonly workspace: string,
    public readonly key: string
  ) {
    this.data = atom(get => {
      const config = get(configAtom)
      const workspaceConfig = config.workspaces[this.workspace]
      if (!workspaceConfig)
        throw new Error(`Workspace "${this.workspace}" not found in config`)
      const rootConfig = getWorkspace(workspaceConfig).roots[this.key]
      if (!rootConfig)
        throw new Error(
          `Root "${this.key}" not found in workspace "${this.workspace}"`
        )
      return getRoot(rootConfig)
    })
    this.explorer = this.children(null)
  }

  children = dispense((parentId: string | null) =>
    createExplorerAtoms(
      {
        workspace: this.workspace,
        root: this.key,
        parentId: parentId ?? undefined
      },
      {
        enableNavigation: true,
        rootData: this.data,
        treeItems: this.treeItems,
        selectionBehavior: 'toggle',
        selectionMode: 'multiple'
      }
    )
  )

  label = atom(get => get(this.data).label)
  icon = atom(get => get(this.data).icon ?? LucideFile)
  i18n = atom((get): RootI18n | undefined => get(this.data).i18n)
  isMedia = atom(get => Boolean(get(this.data).isMediaRoot))
  canCreate = atom(get => {
    return get(policyAtom).canCreate({
      workspace: this.workspace,
      root: this.key
    })
  })
  view = atom((get): ComponentType<RootViewProps> | undefined => {
    const view = get(this.data).view
    if (!view) return undefined
    return typeof view === 'string'
      ? (get(viewAtoms(view)) as ComponentType<RootViewProps> | undefined)
      : view
  })
  private readonly treeSource = atom(async get => {
    get(shaAtom)
    const config = get(configAtom)
    const graph = get(graphAtom)
    const visibleTypes = Object.entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
    return graph.find({
      workspace: this.workspace,
      root: this.key,
      filter: {_type: {in: visibleTypes}},
      status: 'preferDraft',
      select: treeItemSelect
    })
  })
  private readonly treeSources = dispense((locale: string | null) =>
    atom(async get => {
      const entries = await get(this.treeSource)
      const data = get(this.data)
      const config = get(configAtom)
      const graph = get(graphAtom)
      const policy = get(policyAtom)
      const readable = entries.filter(entry => policy.canRead(entry))
      const preferred = preferredLocaleEntries(readable, locale)
      const preferredById = new Map(preferred.map(entry => [entry.id, entry]))
      const visibleTypes = Object.entries(config.schema)
        .filter(([, type]) => !Type.isHidden(type))
        .map(([name]) => name)
      const orderedParents = preferred.flatMap(parent => {
        const orderBy = getType(config.schema[parent.type]).orderChildrenBy
        return orderBy ? [{parentId: parent.id, orderBy}] : []
      })
      const orderQueries = data.orderChildrenBy
        ? [{parentId: null, orderBy: data.orderChildrenBy}, ...orderedParents]
        : orderedParents
      const orderedChildren = await Promise.all(
        orderQueries.map(async ({parentId, orderBy}) => {
          const children = await graph.find({
            workspace: this.workspace,
            root: this.key,
            parentId,
            filter: {_type: {in: visibleTypes}},
            status: 'preferDraft',
            orderBy,
            select: treeItemSelect
          })
          return {
            parentId,
            children: preferredLocaleEntries(
              children.filter(child => policy.canRead(child)),
              locale
            )
          }
        })
      )
      const childrenByParent = new Map<string | null, typeof preferred>()
      for (const entry of preferred) {
        const siblings = childrenByParent.get(entry.parentId) ?? []
        siblings.push(entry)
        childrenByParent.set(entry.parentId, siblings)
      }
      for (const {parentId, children} of orderedChildren) {
        childrenByParent.set(
          parentId,
          children.flatMap(child => {
            const preferredChild = preferredById.get(child.id)
            return preferredChild ? [preferredChild] : []
          })
        )
      }
      const sortedEntries: typeof preferred = []
      function appendChildren(parentId: string | null) {
        for (const child of childrenByParent.get(parentId) ?? []) {
          sortedEntries.push(child)
          appendChildren(child.id)
        }
      }
      appendChildren(null)
      const parentIds = new Set(
        preferred.flatMap(entry => (entry.parentId ? [entry.parentId] : []))
      )
      return sortedEntries.map(entry => {
        const parent = entry.parentId && preferredById.get(entry.parentId)
        return {
          ...entry,
          dragDisabled: Boolean(
            parent && getType(config.schema[parent.type]).orderChildrenBy
          ),
          hasChildren: parentIds.has(entry.id)
        }
      })
    })
  )
  treeItems = dispense((locale: string | null) =>
    unwrap(this.treeSources(locale), previous => previous ?? [])
  )
  private readonly treeItemsById = dispense((locale: string | null) =>
    atom(
      get => new Map(get(this.treeItems(locale)).map(item => [item.id, item]))
    )
  )
  treeChildren = dispense((locale: string | null, parentId: string | null) =>
    atom(get =>
      get(this.treeItems(locale)).flatMap(item =>
        item.parentId === parentId ? [rootTreeNode(item.id)] : []
      )
    )
  )
  treeItem = dispense((locale: string | null, id: string) =>
    atom(get => {
      const item = get(this.treeItemsById(locale)).get(id)
      if (!item) throw new Error(`Tree item "${id}" not found`)
      return item
    })
  )
  selectedTreeItem = dispense((locale: string | null, id: string | undefined) =>
    atom(get => (id ? get(this.treeItemsById(locale)).get(id) : undefined))
  )
  treeReady = dispense((locale: string | null) =>
    atom(async get => {
      get(this.treeItems(locale))
      return get(this.treeSources(locale))
    })
  )
  treeExpandedKeys = atom(new Set<string>())
  treeCollapsedKeys = atom({
    selectedId: undefined as string | undefined,
    keys: new Set<string>()
  })
  acceptedDragTypes = [...dashboardEntryDragTypes]
  getItems = atom(null, (_get, _set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(dashboardEntryDragItem)
  })
  dragDisabled = atom(get => {
    const policy = get(policyAtom)
    const resource = {workspace: this.workspace, root: this.key}
    return !policy.canMove(resource) && !policy.canReorder(resource)
  })
  getDropOperation = atom(
    null,
    (
      _get,
      _set,
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
    async (
      get,
      _set,
      event: DroppableCollectionReorderEvent,
      locale: string | null
    ) => {
      const graph = get(graphAtom)
      const policy = get(policyAtom)
      const treeItemsById = get(this.treeItemsById(locale))
      const moveTarget = event.target.key ? String(event.target.key) : this.key
      const targetType = event.target.key ? 'entry' : 'root'
      for (const key of event.keys) {
        const id = String(key)
        const item = treeItemsById.get(id)
        if (!item || item.dragDisabled) continue
        policy.assert(
          event.target.dropPosition === 'on'
            ? Permission.Move
            : Permission.Reorder,
          {
            workspace: this.workspace,
            root: this.key,
            id,
            type: item.type,
            locale: item.locale,
            parents: item.parents
          }
        )
        await graph.move({
          id,
          target: moveTarget,
          targetType,
          dropPosition: event.target.dropPosition
        })
      }
    }
  )
  onDrop = atom(
    null,
    async (
      get,
      _set,
      event:
        | DroppableCollectionInsertDropEvent
        | DroppableCollectionOnItemDropEvent,
      locale: string | null
    ) => {
      const keys = new Set<Key>()
      for (const item of event.items) {
        if (item.kind !== 'text' || !item.types || !item.getText) continue
        let id: string | null = null
        if (item.types.has(dashboardEntryDragTypes[0]))
          id = await item.getText(dashboardEntryDragTypes[0])
        else if (item.types.has('text/plain'))
          id = await item.getText('text/plain')
        if (id) keys.add(id)
      }
      const graph = get(graphAtom)
      const moveTarget = event.target.key ? String(event.target.key) : this.key
      const targetType = event.target.key ? 'entry' : 'root'
      for (const key of keys) {
        const id = String(key)
        await graph.move({
          id,
          target: moveTarget,
          targetType,
          dropPosition: event.target.dropPosition
        })
      }
    }
  )
}

export const rootAtoms = dispense(
  (workspace: string, root: string) => new RootAtoms(workspace, root)
)
