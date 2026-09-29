import {Config} from '#/core/Config.js'
import {Entry, type EntryStatus} from '#/core/Entry.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import {Permission, type Policy} from '#/core/Role.js'
import type {RootData} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {atom, type PrimitiveAtom} from 'jotai'
import {configAtom, graphAtom} from './core.js'
import {preferredTreeEntries} from './entry.js'
import type {RootTreeItem, RootTreeNode, TreeSource, TreeView} from './root.js'
import {rootAtoms} from './root.js'
import {policyAtom} from './user.js'
import {moveEntries} from './utils.js'

/** An entry that is about to be moved */
export interface MoveSubject {
  id: string
  title: string
  type: string
  workspace: string
  root: string
  locale: string | null
  parentId: string | null
  parents: Array<string>
}

/** An entry of the root that could hold the moved entries */
export interface MoveCandidate {
  id: string
  title: string
  type: string
  status: EntryStatus
  main: boolean
  locale: string | null
  parentId: string | null
  parents: Array<string>
}

/** Where a set of entries can be moved to within their root */
export interface MoveTargets {
  workspace: string
  root: string
  subjects: Array<MoveSubject>
  /** The entries can be moved to the top level of the root */
  rootAccepts: boolean
  /**
   * The listed entries: the ones that accept the moved entries and their
   * ancestors, with a row for each locale they exist in
   */
  candidates: Array<MoveCandidate>
  /** The ids of the entries the moved entries can be moved into */
  accepts: Set<string>
}

export interface ResolveMoveTargetsOptions {
  config: Config
  policy: Policy
  rootData: RootData
  workspace: string
  root: string
  subjects: Array<MoveSubject>
  candidates: Array<MoveCandidate>
}

/**
 * Whether entries of the given type can be placed at the top level of a root.
 * Roots that do not list the types they contain accept every type, media
 * roots always hold files.
 */
export function rootAcceptsType(
  config: Config,
  rootData: RootData,
  typeName: string
): boolean {
  const contains = rootData.contains
  if (!contains?.length) return true
  if (rootData.isMediaRoot && config.schema[typeName] === MediaFile) return true
  return Schema.contained(config.schema, contains).includes(typeName)
}

/**
 * Where the subjects can be moved to, following the `contains` rules of the
 * types and root, and the move permission. The subjects and their children
 * are never a target.
 */
export function resolveMoveTargets({
  config,
  policy,
  rootData,
  workspace,
  root,
  subjects,
  candidates
}: ResolveMoveTargetsOptions): MoveTargets {
  const moving = new Set(subjects.map(subject => subject.id))
  const typeNames = Array.from(new Set(subjects.map(subject => subject.type)))
  const types = typeNames.map(name => config.schema[name])
  // Entries of unknown types can not be placed anywhere
  const movable = subjects.length > 0 && types.every(type => type !== undefined)
  const available = candidates.filter(
    candidate =>
      !moving.has(candidate.id) &&
      !candidate.parents.some(parent => moving.has(parent))
  )
  const accepts = new Set<string>()
  if (movable)
    for (const candidate of available) {
      if (accepts.has(candidate.id)) continue
      const parentType = config.schema[candidate.type]
      if (!parentType || Type.isHidden(parentType)) continue
      const containsAll = types.every(
        type => type && Config.typeContains(config, parentType, type)
      )
      if (!containsAll) continue
      const canMove = policy.canMove({
        workspace,
        root,
        id: candidate.id,
        type: candidate.type,
        locale: candidate.locale,
        parents: candidate.parents
      })
      if (canMove) accepts.add(candidate.id)
    }
  const listed = new Set<string>()
  for (const candidate of available) {
    if (!accepts.has(candidate.id)) continue
    listed.add(candidate.id)
    for (const parent of candidate.parents) listed.add(parent)
  }
  const rootAccepts =
    movable &&
    typeNames.every(name => rootAcceptsType(config, rootData, name)) &&
    policy.canMove({workspace, root})
  return {
    workspace,
    root,
    subjects,
    rootAccepts,
    candidates: available.filter(candidate => listed.has(candidate.id)),
    accepts
  }
}

/**
 * Whether moving to the target changes nothing: every subject is already
 * placed there. The root is targeted with null.
 */
export function isCurrentMoveTarget(
  targets: MoveTargets,
  target: string | null
): boolean {
  return targets.subjects.every(subject => subject.parentId === target)
}

/** The target can be picked to move the subjects into */
export function canMoveTo(
  targets: MoveTargets,
  target: string | null | undefined
): target is string | null {
  if (target === undefined) return false
  const accepted =
    target === null ? targets.rootAccepts : targets.accepts.has(target)
  return accepted && !isCurrentMoveTarget(targets, target)
}

/** The tree of move targets as shown in the given locale */
export function moveTargetView(
  targets: MoveTargets,
  locale: string | null,
  expandedKeys: Set<string>,
  target: string | null | undefined
): TreeView {
  const shown = preferredTreeEntries(targets.candidates, locale)
  const children = new Map<string | null, Array<MoveCandidate>>()
  for (const candidate of shown) {
    const siblings = children.get(candidate.parentId) ?? []
    siblings.push(candidate)
    children.set(candidate.parentId, siblings)
  }
  const items = new Map<string, RootTreeItem>()
  for (const candidate of shown)
    items.set(candidate.id, {
      id: candidate.id,
      title: candidate.title,
      type: candidate.type,
      status: candidate.status,
      main: candidate.main,
      locale: candidate.locale,
      parentId: candidate.parentId,
      parents: candidate.parents,
      hasChildren: children.has(candidate.id),
      dragDisabled: true
    })
  function nested(parentId: string | null): Array<RootTreeNode> {
    return (children.get(parentId) ?? []).map(candidate => ({
      id: candidate.id,
      children: expandedKeys.has(candidate.id) ? nested(candidate.id) : []
    }))
  }
  return {
    entries: items,
    snapshot: {
      expandedKeys,
      items: nested(null),
      selectedKeys: new Set(typeof target === 'string' ? [target] : [])
    }
  }
}

/** The state of a dialog that picks where to move entries */
export class MoveTree implements TreeSource {
  readonly expandedKeys: PrimitiveAtom<Set<string>>
  readonly locale: PrimitiveAtom<string | null>
  /** The picked target, null for the root and undefined until picked */
  readonly target = atom<string | null | undefined>(undefined)
  readonly view = atom(get =>
    moveTargetView(
      this.targets,
      get(this.locale),
      get(this.expandedKeys),
      get(this.target)
    )
  )
  readonly selectedItem = atom(get => {
    const target = get(this.target)
    return target ? get(this.view).entries.get(target) : undefined
  })
  readonly canConfirm = atom(get => canMoveTo(this.targets, get(this.target)))
  /** Picks a target, entries that do not accept the subjects are expanded */
  readonly pick = atom(null, (_get, set, target: string | null) => {
    const accepted =
      target === null
        ? this.targets.rootAccepts
        : this.targets.accepts.has(target)
    if (accepted) set(this.target, target)
  })

  constructor(
    readonly targets: MoveTargets,
    locale: string | null
  ) {
    this.locale = atom(locale)
    // Open the tree at the current location of the entries
    const listed = new Set(targets.candidates.map(candidate => candidate.id))
    const [first] = targets.subjects
    this.expandedKeys = atom(
      new Set(first?.parents.filter(parent => listed.has(parent)) ?? [])
    )
  }
}

const moveTargetSelect = {
  id: Entry.id,
  title: Entry.title,
  type: Entry.type,
  status: Entry.status,
  main: Entry.main,
  locale: Entry.locale,
  parentId: Entry.parentId,
  parents: Entry.parents
}

/** Loads where the subjects, all of one root, can be moved to */
export const loadMoveTreeAtom = atom(
  null,
  async (
    get,
    _set,
    subjects: Array<MoveSubject>,
    locale: string | null
  ): Promise<MoveTree> => {
    const [first] = subjects
    if (!first) throw new Error('Nothing to move')
    const {workspace, root} = first
    const config = get(configAtom)
    const policy = get(policyAtom)
    const containers = entries(config.schema)
      .filter(([, type]) => Type.isContainer(type) && !Type.isHidden(type))
      .map(([name]) => name)
    const rows =
      containers.length === 0
        ? []
        : await get(graphAtom).find({
            workspace,
            root,
            filter: {_type: {in: containers}},
            orderBy: {asc: Entry.index},
            status: 'preferDraft',
            select: moveTargetSelect
          })
    const targets = resolveMoveTargets({
      config,
      policy,
      rootData: get(rootAtoms(workspace, root).data),
      workspace,
      root,
      subjects,
      candidates: rows.filter(row => policy.canRead({workspace, root, ...row}))
    })
    return new MoveTree(targets, locale)
  }
)

/** Moves the subjects of the tree to the picked target */
export const moveEntriesAtom = atom(null, async (get, _set, tree: MoveTree) => {
  const target = get(tree.target)
  if (!canMoveTo(tree.targets, target)) return
  const {root, subjects} = tree.targets
  const moving = subjects.filter(subject => subject.parentId !== target)
  const policy = get(policyAtom)
  for (const subject of moving) policy.assert(Permission.Move, subject)
  const graph = get(graphAtom)
  const ids = moving.map(subject => subject.id)
  if (target !== null)
    return moveEntries(graph, ids, {key: target, position: 'on'})
  for (const id of ids)
    await graph.move({id, target: root, targetType: 'root', dropPosition: 'on'})
})
