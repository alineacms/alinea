import {Button, Toolbar} from '#/components.js'
import {
  archiveEntriesAtom,
  deleteEntriesAtom,
  loadDeletePlanAtom,
  type DeletePlan
} from '#/dashboard/atoms/delete.js'
import type {
  DashboardExplorer,
  ExplorerItemData
} from '#/dashboard/atoms/explorer.js'
import {loadMoveTargetsAtom, type MoveTargets} from '#/dashboard/atoms/move.js'
import styler from '@alinea/styler'
import {useAtomValueRawSync, useSetAtom} from 'jotai'
import {
  createContext,
  type ReactNode,
  useContext,
  useState,
  useTransition
} from 'react'
import {IcRoundClose, IcRoundDelete, IcRoundDriveFileMove} from '../icons.js'
import {DeleteDialog} from './DeleteDialog.js'
import css from './ExplorerBatchActions.module.css'
import {MoveDialog} from './MoveDialog.js'

const styles = styler(css)

interface ExplorerItemActionsValue {
  isPending: boolean
  move(items: Array<ExplorerItemData>): void
  remove(items: Array<ExplorerItemData>): void
}

const ExplorerItemActionsContext =
  createContext<ExplorerItemActionsValue | null>(null)

/** Moves or deletes entries, from the selection or the menu of a row */
export function useExplorerItemActions(): ExplorerItemActionsValue {
  const actions = useContext(ExplorerItemActionsContext)
  if (!actions) throw new Error('Missing ExplorerItemActions')
  return actions
}

export interface ExplorerItemActionsProps {
  explorer: DashboardExplorer
  children: ReactNode
}

/** Holds the move and delete dialogs of the entries of an overview */
export function ExplorerItemActions({
  explorer,
  children
}: ExplorerItemActionsProps) {
  const clearSelection = useSetAtom(explorer.clearSelection)
  const loadDeletePlan = useSetAtom(loadDeletePlanAtom)
  const deleteEntries = useSetAtom(deleteEntriesAtom)
  const archiveEntries = useSetAtom(archiveEntriesAtom)
  const loadMoveTargets = useSetAtom(loadMoveTargetsAtom)
  const [moving, setMoving] = useState<MoveTargets>()
  const [deletePlan, setDeletePlan] = useState<DeletePlan>()
  const [isPending, startTransition] = useTransition()
  const actions: ExplorerItemActionsValue = {
    isPending,
    move(items) {
      startTransition(async () => {
        setMoving(await loadMoveTargets(items))
      })
    },
    // Entries with languages are deleted in the listed language only
    remove(items) {
      startTransition(async () => {
        setDeletePlan(await loadDeletePlan(items))
      })
    }
  }
  return (
    <ExplorerItemActionsContext.Provider value={actions}>
      {children}
      <MoveDialog
        targets={moving}
        onClose={() => setMoving(undefined)}
        onMoved={clearSelection}
      />
      <DeleteDialog
        plan={deletePlan}
        onClose={() => setDeletePlan(undefined)}
        onConfirm={async plan => {
          await deleteEntries(plan)
          clearSelection()
        }}
        onArchive={async plan => {
          await archiveEntries(plan)
          clearSelection()
        }}
      />
    </ExplorerItemActionsContext.Provider>
  )
}

export interface ExplorerBatchActionsProps {
  explorer: DashboardExplorer
}

/** Acts on the entries selected in an overview */
export function ExplorerBatchActions({explorer}: ExplorerBatchActionsProps) {
  const {items, canMove, canDelete} = useAtomValueRawSync(
    explorer.selectionActions
  )
  const clearSelection = useSetAtom(explorer.clearSelection)
  const actions = useExplorerItemActions()
  if (items.length === 0) return null
  return (
    <ExplorerBatchActionBar
      count={items.length}
      canDelete={canDelete}
      canMove={canMove}
      isPending={actions.isPending}
      onClear={clearSelection}
      onDelete={() => actions.remove(items)}
      onMove={() => actions.move(items)}
    />
  )
}

export interface ExplorerBatchActionBarProps {
  count: number
  canDelete: boolean
  canMove: boolean
  isPending?: boolean
  onClear(): void
  onDelete(): void
  onMove(): void
}

/** Floats over the list: how many entries are selected and their actions */
export function ExplorerBatchActionBar({
  count,
  canDelete,
  canMove,
  isPending = false,
  onClear,
  onDelete,
  onMove
}: ExplorerBatchActionBarProps) {
  return (
    <Toolbar
      aria-label="Selected entries"
      className={styles.ExplorerBatchActionBar()}
    >
      <span className={styles.ExplorerBatchActionBar.count()}>
        {count} selected
      </span>
      {canMove && (
        <Button
          icon={IcRoundDriveFileMove}
          size="sm"
          variant="ghost"
          disabled={isPending}
          loading={isPending}
          onClick={onMove}
        >
          Move to…
        </Button>
      )}
      {canDelete && (
        <Button
          color="destructive"
          icon={IcRoundDelete}
          size="sm"
          variant="ghost"
          disabled={isPending}
          loading={isPending}
          onClick={onDelete}
        >
          Delete
        </Button>
      )}
      <span
        aria-hidden="true"
        className={styles.ExplorerBatchActionBar.divider()}
      />
      <Button
        aria-label="Clear selection"
        icon={IcRoundClose}
        size="icon-sm"
        variant="ghost"
        onClick={onClear}
      />
    </Toolbar>
  )
}
