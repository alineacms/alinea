import type {DropTarget} from '#/components.js'
import {isDocument} from '#/core/Document.js'
import {Entry} from '#/core/Entry.js'
import {atom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import {configAtom, graphAtom} from './core.js'

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

/**
 * Ask before entries of a document type are dropped under another parent,
 * which changes their url and those of the pages below them. Resolves
 * whether to move.
 */
export const confirmMoveAtom = atom(
  null,
  async (
    get,
    set,
    ids: Iterable<string>,
    target: DropTarget
  ): Promise<boolean> => {
    if (!get(confirmMovesAtom)) return true
    const graph = get(graphAtom)
    const {schema} = get(configAtom)
    const parentId =
      target.position === 'on'
        ? String(target.key)
        : await graph.first({
            id: String(target.key),
            status: 'preferDraft',
            select: Entry.parentId
          })
    const moving = await graph.find({
      id: {in: [...ids]},
      status: 'preferDraft',
      select: {
        id: Entry.id,
        title: Entry.title,
        type: Entry.type,
        parentId: Entry.parentId
      }
    })
    const pages = new Map<string, string>()
    for (const entry of moving) {
      const type = schema[entry.type]
      if (!type || !isDocument(type) || entry.parentId === parentId) continue
      pages.set(entry.id, entry.title)
    }
    if (pages.size === 0) return true
    return new Promise(resolve =>
      set(moveConfirmationAtom, {
        pages: [...pages].map(([id, title]) => ({id, title})),
        resolve(confirmed) {
          set(moveConfirmationAtom, undefined)
          resolve(confirmed)
        }
      })
    )
  }
)
