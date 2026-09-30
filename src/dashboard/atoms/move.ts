import {Config} from '#/core/Config.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {Filter} from '#/core/Filter.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import type {Policy} from '#/core/Role.js'
import type {RootData} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {atom} from 'jotai'
import {graphAtom} from './core.js'
import type {ExplorerItemData} from './explorer.js'
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

/** Where entries of one root can be moved to */
export interface MoveTargets {
  /** The entries of a type that holds every moved entry */
  condition: Filter<EntryFields>
  /** The moved entries, their children and entries without the move permission are not a target */
  canSelect(item: ExplorerItemData): boolean
  /** The entries can be moved to the top level of the root */
  rootAccepts: boolean
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
 * Where the subjects, all of one root, can be moved to following the
 * `contains` rules of the types and root, and the move permission
 */
export function moveTargets(
  config: Config,
  policy: Policy,
  rootData: RootData,
  subjects: Array<MoveSubject>
): MoveTargets {
  const moving = new Set(subjects.map(subject => subject.id))
  const typeNames = Array.from(new Set(subjects.map(subject => subject.type)))
  const types = typeNames.map(name => config.schema[name])
  const [first] = subjects
  // Entries of unknown types can not be placed anywhere
  const movable = first !== undefined && types.every(type => type !== undefined)
  const containers = entries(config.schema)
    .filter(
      ([, parent]) =>
        movable &&
        !Type.isHidden(parent) &&
        types.every(type => type && Config.typeContains(config, parent, type))
    )
    .map(([name]) => name)
  return {
    condition: {_type: {in: containers}},
    canSelect: item =>
      !moving.has(item.id) &&
      !item.parents.some(parent => moving.has(parent)) &&
      policy.canMove(item),
    rootAccepts:
      movable &&
      typeNames.every(name => rootAcceptsType(config, rootData, name)) &&
      policy.canMove({workspace: first.workspace, root: first.root})
  }
}

/** Moves the subjects into the target entry, or to the root with null */
export const moveEntriesAtom = atom(
  null,
  async (get, _set, subjects: Array<MoveSubject>, target: string | null) => {
    const graph = get(graphAtom)
    const moving = subjects.filter(subject => subject.parentId !== target)
    if (target !== null)
      return moveEntries(
        graph,
        moving.map(subject => subject.id),
        {key: target, position: 'on'}
      )
    for (const {id, root} of moving)
      await graph.move({
        id,
        target: root,
        targetType: 'root',
        dropPosition: 'on'
      })
  }
)
