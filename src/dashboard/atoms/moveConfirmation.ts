import type {DropTarget, Key} from '#/components.js'
import {isDocument} from '#/core/Document.js'
import {Entry} from '#/core/Entry.js'
import {atom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import {configAtom, graphAtom} from './core.js'
import {loadMoveTargetsAtom} from './move.js'
import {policyAtom} from './user.js'

/**
 * A dragged move to confirm: the pages it gives another parent, and so
 * another url, or why it can not move there
 */
export interface MoveConfirmation {
  pages: Array<{id: string; title: string}>
  refusal?: string
  resolve(confirmed: boolean): void
}

/** Whether moving pages asks first, until the editor stops it here */
export const confirmMovesAtom = atomWithStorage(
  'alinea-dashboard-confirm-moves',
  true,
  undefined,
  {getOnInit: true}
)

/**
 * The entries being dragged, known from the start of a drag so that drop
 * targets can turn down the ones they can not hold
 */
export const draggedEntriesAtom = atom<ReadonlySet<Key>>(new Set<Key>())

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
    const ask = (question: Omit<MoveConfirmation, 'resolve'>) =>
      new Promise<boolean>(resolve =>
        set(moveConfirmationAtom, {
          ...question,
          resolve(confirmed) {
            set(moveConfirmationAtom, undefined)
            resolve(confirmed)
          }
        })
      )
    const refusal = await movingRefusal()
    if (refusal) return ask({pages: [], refusal}).then(() => false)
    const {schema} = get(configAtom)
    const pages = moved.filter(subject => {
      const type = schema[subject.type]
      return type && isDocument(type)
    })
    if (pages.length === 0 || !get(confirmMovesAtom)) return true
    return ask({pages: pages.map(({id, title}) => ({id, title}))})

    async function movingRefusal(): Promise<string | undefined> {
      const policy = get(policyAtom)
      for (const subject of moved) {
        if (
          subject.workspace !== dropped!.workspace ||
          subject.root !== dropped!.root
        )
          return 'Entries can only be moved within their own root.'
        if (subject.seeded)
          return `"${subject.title}" is part of the site setup and can not be moved.`
        if (!policy.canMove(subject))
          return `You can not move "${subject.title}".`
      }
      const targets = await set(loadMoveTargetsAtom, moved)
      if (parentId === null) return targets.refusal(null)
      const parent =
        parentId === dropped!.id
          ? dropped!
          : await graph.first({...query, id: parentId})
      return parent ? targets.refusal(parent) : 'The new parent was not found.'
    }
  }
)
