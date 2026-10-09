import type {DropTarget} from '#/components.js'
import {isDocument} from '#/core/Document.js'
import {Entry} from '#/core/Entry.js'
import {atom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import {configAtom, graphAtom} from './core.js'
import {loadMoveTargetsAtom} from './move.js'
import {policyAtom} from './user.js'

/** Pages that a move gives another parent, and so another url */
export interface MoveConfirmation {
  pages: Array<{id: string; title: string}>
  resolve(confirmed: boolean): void
}

/** Whether moving pages asks first, until the editor stops it here */
export const confirmMovesAtom = atomWithStorage(
  'alinea-dashboard-confirm-moves',
  true,
  undefined,
  {getOnInit: true}
)

export const moveConfirmationAtom = atom<MoveConfirmation | undefined>(
  undefined
)

const moveItem = {
  id: Entry.id,
  title: Entry.title,
  type: Entry.type,
  workspace: Entry.workspace,
  root: Entry.root,
  locale: Entry.locale,
  parentId: Entry.parentId,
  parents: Entry.parents,
  seeded: Entry.seeded
}

/**
 * Whether entries dropped on a target can move there, and the editor agrees:
 * entries that get another parent follow the rules of moving them with the
 * move dialog, and entries of a document type ask first, as their url and
 * those of the pages below them change.
 */
export const confirmMoveAtom = atom(
  null,
  async (
    get,
    set,
    ids: Iterable<string>,
    target: DropTarget
  ): Promise<boolean> => {
    const graph = get(graphAtom)
    const query = {status: 'preferDraft', select: moveItem} as const
    const [rows, dropped] = await Promise.all([
      graph.find({...query, id: {in: [...ids]}}),
      graph.first({...query, id: String(target.key)})
    ])
    if (!dropped) return false
    const subjects = [...new Map(rows.map(row => [row.id, row])).values()]
    const parentId = target.position === 'on' ? dropped.id : dropped.parentId
    const moved = subjects.filter(
      subject =>
        subject.parentId !== parentId ||
        subject.workspace !== dropped.workspace ||
        subject.root !== dropped.root
    )
    // Reordering among the same children follows the drop rules of the list
    if (moved.length === 0) return true
    // Entries move within their root, seeded entries stay where they are
    const policy = get(policyAtom)
    const misplaced = moved.some(
      subject =>
        subject.seeded ||
        subject.workspace !== dropped.workspace ||
        subject.root !== dropped.root ||
        !policy.canMove(subject)
    )
    if (misplaced) return false
    const targets = await set(loadMoveTargetsAtom, moved)
    const parent =
      parentId === dropped.id
        ? dropped
        : parentId && (await graph.first({...query, id: parentId}))
    const accepted =
      parentId === null
        ? targets.rootAccepts
        : Boolean(parent && targets.accepts(parent))
    if (!accepted) return false
    const {schema} = get(configAtom)
    const pages = moved.filter(subject => {
      const type = schema[subject.type]
      return type && isDocument(type)
    })
    if (pages.length === 0 || !get(confirmMovesAtom)) return true
    return new Promise(resolve =>
      set(moveConfirmationAtom, {
        pages: pages.map(({id, title}) => ({id, title})),
        resolve(confirmed) {
          set(moveConfirmationAtom, undefined)
          resolve(confirmed)
        }
      })
    )
  }
)
