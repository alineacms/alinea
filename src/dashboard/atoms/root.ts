import {Entry, type EntryStatus} from '#/core/Entry.js'
import {Permission} from '#/core/Role.js'
import type {RootData, RootI18n} from '#/core/Root.js'
import {Type} from '#/core/Type.js'
import type {
  DragItem,
  DragTypes,
  DropItem,
  DropOperation,
  DropTarget,
  ItemDropTarget
} from '@react-types/shared'
import {
  createExplorerAtoms,
  type ExplorerAtoms
} from '#/dashboard/atoms/explorer.js'
import {type Atom, type Getter, atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import type {ComponentType} from 'react'
import type {
  DroppableCollectionInsertDropEvent,
  DroppableCollectionOnItemDropEvent,
  DroppableCollectionReorderEvent,
  Key
} from 'react-aria-components'
import {LucideFile} from '../icons.js'
import {workspaceAtoms, viewAtoms} from './config.js'
import {configAtom, graphAtom} from './core.js'
import {shaAtom} from './graph.js'
import {policyAtom} from './user.js'
import {routeAtom} from './nav.js'
import {dispense} from './utils.js'

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

const treeExpandedKeysAtoms = dispense((_workspace: string) =>
  dispense((_root: string) => atom(new Set<string>()))
)

export class RootAtoms {
  explorer: ExplorerAtoms

  constructor(
    public readonly workspace: string,
    public readonly key: string,
    public readonly locale: string | null,
    public readonly data: Atom<RootData>
  ) {
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
        selectedLocale: this.locale,
        selectionBehavior: 'toggle',
        selectionMode: 'multiple'
      }
    )
  )

  label = atom(get => get(this.data).label)
  icon = atom(get => get(this.data).icon ?? LucideFile)
  i18n = atom((get): RootI18n | undefined => get(this.data).i18n)
  selectedLocale = atom(
    get => {
      const i18n = get(this.i18n)
      return this.locale && i18n?.locales.includes(this.locale)
        ? this.locale
        : (i18n?.locales[0] ?? null)
    },
    (get, set, locale: string) => {
      const route = get(routeAtom)
      set(routeAtom, {
        workspace: this.workspace,
        root: this.key,
        entry: route.entry,
        locale
      })
    }
  )
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
  treeReady = atom(async get => {
    get(shaAtom)
    const data = get(this.data)
    const config = get(configAtom)
    const graph = get(graphAtom)
    const policy = get(policyAtom)
    const selectedLocale = get(this.selectedLocale)
    const visibleTypes = Object.entries(config.schema)
      .filter(([, type]) => !Type.isHidden(type))
      .map(([name]) => name)
    const entries = await graph.find({
      workspace: this.workspace,
      root: this.key,
      filter: {_type: {in: visibleTypes}},
      status: 'preferDraft',
      orderBy: data.orderChildrenBy,
      select: {
        id: Entry.id,
        title: Entry.title,
        type: Entry.type,
        status: Entry.status,
        main: Entry.main,
        locale: Entry.locale,
        parentId: Entry.parentId,
        parents: Entry.parents
      }
    })
    const readable = entries.filter(entry => policy.canRead(entry))
    const preferred = new Map<string, (typeof readable)[number]>()
    for (const entry of readable) {
      const current = preferred.get(entry.id)
      if (!current || entry.locale === selectedLocale)
        preferred.set(entry.id, entry)
    }
    const parentIds = new Set(
      Array.from(preferred.values()).flatMap(entry =>
        entry.parentId ? [entry.parentId] : []
      )
    )
    return Array.from(preferred.values()).map(entry => ({
      ...entry,
      hasChildren: parentIds.has(entry.id)
    }))
  })
  treeItems = unwrap(this.treeReady, previous => previous ?? [])
  treeExpandedKeys = atom(
    get => get(treeExpandedKeysAtoms(this.workspace)(this.key)),
    (
      _get,
      set,
      next: Set<string> | ((current: Set<string>) => Set<string>)
    ) => {
      set(treeExpandedKeysAtoms(this.workspace)(this.key), next)
    }
  )

  acceptedDragTypes = [DASHBOARD_ENTRY_DRAG_TYPE, 'text/plain']
  getItems = atom(null, (_get, _set, keys: Set<Key>): Array<DragItem> => {
    return [...keys].map(dragItem)
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
    async (get, _set, event: DroppableCollectionReorderEvent) => {
      await this.moveDraggedKeys(get, event.keys, event.target)
    }
  )
  onInsert = atom(
    null,
    async (get, _set, event: DroppableCollectionInsertDropEvent) => {
      await this.moveDropItems(get, event.items, event.target)
    }
  )
  onItemDrop = atom(
    null,
    async (get, _set, event: DroppableCollectionOnItemDropEvent) => {
      await this.moveDropItems(get, event.items, event.target)
    }
  )

  private async moveDraggedKeys(
    get: Getter,
    keys: Set<Key>,
    target: ItemDropTarget
  ) {
    const graph = get(graphAtom)
    const policy = get(policyAtom)
    const treeItems = get(this.treeItems)
    const moveTarget = target.key ? String(target.key) : this.key
    const targetType = target.key ? 'entry' : 'root'
    for (const key of keys) {
      const id = String(key)
      const item = treeItems.find(candidate => candidate.id === id)
      if (!item) continue
      policy.assert(
        target.dropPosition === 'on' ? Permission.Move : Permission.Reorder,
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
        dropPosition: target.dropPosition
      })
    }
  }

  private async moveDropItems(
    get: Getter,
    items: Array<DropItem>,
    target: ItemDropTarget
  ) {
    const keys = new Set<Key>()
    for (const item of items) {
      if (item.kind !== 'text' || !item.types || !item.getText) continue
      let id: string | null = null
      if (item.types.has(DASHBOARD_ENTRY_DRAG_TYPE))
        id = await item.getText(DASHBOARD_ENTRY_DRAG_TYPE)
      else if (item.types.has('text/plain'))
        id = await item.getText('text/plain')
      if (id) keys.add(id)
    }
    await this.moveDraggedKeys(get, keys, target)
  }
}

const rootLocaleAtoms = dispense((workspace: string) =>
  dispense((root: string) =>
    dispense((locale: string | null) => {
      const data = workspaceAtoms(workspace).rootsAtom(root)
      return new RootAtoms(workspace, root, locale, data)
    })
  )
)

export function rootAtoms(
  workspace: string,
  root: string,
  locale: string | null
) {
  return rootLocaleAtoms(workspace)(root)(locale)
}
