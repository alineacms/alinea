import {Config} from '#/core/Config.js'
import {MoveOperation} from '#/core/db/Operation.js'
import {Entry} from '#/core/Entry.js'
import {getRoot, getWorkspace} from '#/core/Internal.js'
import type {EntryFields} from '#/core/EntryFields.js'
import type {Filter} from '#/core/Filter.js'
import {MediaFile} from '#/core/media/MediaTypes.js'
import type {Policy} from '#/core/Role.js'
import type {RootData} from '#/core/Root.js'
import {Schema} from '#/core/Schema.js'
import {Type} from '#/core/Type.js'
import {entries} from '#/core/util/Objects.js'
import {atom} from 'jotai'
import {configAtom, graphAtom} from './core.js'
import type {ExplorerItemData} from './explorer.js'
import {policyAtom} from './user.js'

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
  subjects: Array<MoveSubject>
  /** The entries of a type that holds every moved entry */
  condition: Filter<EntryFields>
  /**
   * The moved entries, their children, entries without the move permission
   * and entries missing a language of the moved entries are not a target
   */
  canSelect(item: ExplorerItemData): boolean
  /**
   * Why the entries can not move into `parent`, or to the top level of the
   * root with null; undefined when they can
   */
  refusal(parent: MoveSubject | null): string | undefined
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

/** The subjects without those inside another subject, which move with it */
function outermostSubjects(subjects: Array<MoveSubject>): Array<MoveSubject> {
  const ids = new Set(subjects.map(subject => subject.id))
  return subjects.filter(
    subject => !subject.parents.some(parent => ids.has(parent))
  )
}

/**
 * Where the subjects, all of one root, can be moved to following the
 * `contains` rules of the types and root, and the move permission. When
 * given, only the `translated` entries are a target. Subjects inside another
 * subject are left out, they move along with it.
 */
export function moveTargets(
  config: Config,
  policy: Policy,
  rootData: RootData,
  selected: Array<MoveSubject>,
  translated?: ReadonlySet<string>
): MoveTargets {
  const subjects = outermostSubjects(selected)
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
  const canSelect = (item: MoveSubject) =>
    !moving.has(item.id) &&
    !item.parents.some(parent => moving.has(parent)) &&
    (!translated || translated.has(item.id)) &&
    policy.canMove(item)
  return {
    subjects,
    condition: {_type: {in: containers}},
    canSelect,
    refusal(parent) {
      if (!movable) return 'These entries can not be moved.'
      const single = subjects.length === 1
      const these = single ? `"${first.title}"` : 'these entries'
      const These = single ? these : 'These entries'
      const kinds = typeNames
        .map(name => Type.label(config.schema[name]!))
        .join(' or ')
      if (!parent) {
        if (!typeNames.every(name => rootAcceptsType(config, rootData, name)))
          return `${rootData.label} does not hold ${kinds} at its top level.`
        if (!policy.canMove({workspace: first.workspace, root: first.root}))
          return `You can not move entries to the top level of ${rootData.label}.`
        return undefined
      }
      if (moving.has(parent.id) || parent.parents.some(id => moving.has(id)))
        return `${These} can not be moved into itself.`
      if (!containers.includes(parent.type))
        return `"${parent.title}" can not hold ${kinds}.`
      if (translated && !translated.has(parent.id))
        return `"${parent.title}" does not exist in every language of ${these}.`
      if (!policy.canMove(parent))
        return `You can not move entries into "${parent.title}".`
      return undefined
    },
    rootAccepts:
      movable &&
      typeNames.every(name => rootAcceptsType(config, rootData, name)) &&
      policy.canMove({workspace: first.workspace, root: first.root})
  }
}

/**
 * Loads where the subjects can be moved to. A moved entry needs its new
 * parent in each of its languages, so in a root with languages only the
 * entries that exist in every language of the subjects are a target.
 */
export const loadMoveTargetsAtom = atom(
  null,
  async (get, _set, subjects: Array<MoveSubject>): Promise<MoveTargets> => {
    const config = get(configAtom)
    const policy = get(policyAtom)
    const [{workspace, root}] = subjects as [MoveSubject]
    const rootData = getRoot(
      getWorkspace(config.workspaces[workspace]).roots[root]
    )
    const targets = moveTargets(config, policy, rootData, subjects)
    if (!rootData.i18n) return targets
    const graph = get(graphAtom)
    const [locales, rows] = await Promise.all([
      graph.find({
        workspace,
        root,
        id: {in: subjects.map(subject => subject.id)},
        status: 'all',
        select: Entry.locale
      }),
      graph.find({
        workspace,
        root,
        filter: targets.condition,
        status: 'preferPublished',
        select: {id: Entry.id, locale: Entry.locale}
      })
    ])
    const needed = new Set(locales)
    const found = new Map<string, number>()
    for (const {id, locale} of rows)
      if (needed.has(locale)) found.set(id, (found.get(id) ?? 0) + 1)
    const translated = new Set(
      Array.from(found)
        .filter(([, count]) => count === needed.size)
        .map(([id]) => id)
    )
    return moveTargets(config, policy, rootData, subjects, translated)
  }
)

/**
 * Moves the subjects into the target entry, or to the root with null, in one
 * transaction: every entry moves or none do. Subjects inside another subject
 * move along with it.
 */
export const moveEntriesAtom = atom(
  null,
  async (get, _set, subjects: Array<MoveSubject>, target: string | null) => {
    const moving = outermostSubjects(subjects).filter(
      subject => subject.parentId !== target
    )
    if (moving.length === 0) return
    await get(graphAtom).commit(
      ...moving.map(
        ({id, root}) =>
          new MoveOperation(
            target === null
              ? {id, target: root, targetType: 'root', dropPosition: 'on'}
              : {id, target, targetType: 'entry', dropPosition: 'on'}
          )
      )
    )
  }
)
