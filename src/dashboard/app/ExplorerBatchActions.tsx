import {Button, Toolbar} from '#/components.js'
import type {DashboardExplorer} from '#/dashboard/atoms/explorer.js'
import {loadMoveTargetsAtom, type MoveTargets} from '#/dashboard/atoms/move.js'
import {
  archiveEntriesAtom,
  deleteEntriesAtom,
  loadRemovePlanAtom,
  type RemovePlan
} from '#/dashboard/atoms/remove.js'
import styler from '@alinea/styler'
import {useAtomValueRawSync, useSetAtom} from 'jotai'
import {type ReactNode, useState, useTransition} from 'react'
import {IcRoundClose, IcRoundDelete, IcRoundDriveFileMove} from '../icons.js'
import css from './ExplorerBatchActions.module.css'
import {MoveDialog} from './MoveDialog.js'
import {RemoveDialog} from './RemoveDialog.js'

const styles = styler(css)

export interface ExplorerBatchActionsProps {
  explorer: DashboardExplorer
}

/** Acts on the entries selected in an overview */
export function ExplorerBatchActions({explorer}: ExplorerBatchActionsProps) {
  const {items, canMove, canDelete} = useAtomValueRawSync(
    explorer.selectionActions
  )
  const clearSelection = useSetAtom(explorer.clearSelection)
  const loadRemovePlan = useSetAtom(loadRemovePlanAtom)
  const deleteEntries = useSetAtom(deleteEntriesAtom)
  const archiveEntries = useSetAtom(archiveEntriesAtom)
  const loadMoveTargets = useSetAtom(loadMoveTargetsAtom)
  const [moving, setMoving] = useState<MoveTargets>()
  const [deletePlan, setDeletePlan] = useState<RemovePlan>()
  const [isPending, startTransition] = useTransition()
  if (items.length === 0) return null

  function openMoveDialog() {
    startTransition(async () => {
      setMoving(await loadMoveTargets(items))
    })
  }

  // Entries with languages are deleted in the listed language only
  function openDeleteDialog() {
    startTransition(async () => {
      setDeletePlan(await loadRemovePlan(items))
    })
  }

  return (
    <>
      <ExplorerBatchActionBar
        count={items.length}
        canDelete={canDelete}
        canMove={canMove}
        isPending={isPending}
        onClear={clearSelection}
        onDelete={openDeleteDialog}
        onMove={openMoveDialog}
      />
      <MoveDialog
        targets={moving}
        onClose={() => setMoving(undefined)}
        onMoved={clearSelection}
      />
      <RemoveDialog
        action="delete"
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
    </>
  )
}

export interface ExplorerBatchActionBarProps {
  count: number
  /** Every selected entry can be deleted */
  canDelete: boolean
  /** Every selected entry can be moved */
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
      <ExplorerBatchAction
        reason={canMove ? undefined : 'Not all selected entries can be moved'}
      >
        <Button
          icon={IcRoundDriveFileMove}
          size="sm"
          variant="ghost"
          disabled={isPending || !canMove}
          loading={isPending}
          onClick={onMove}
        >
          Move to…
        </Button>
      </ExplorerBatchAction>
      <ExplorerBatchAction
        reason={
          canDelete ? undefined : 'Not all selected entries can be deleted'
        }
      >
        <Button
          color="destructive"
          icon={IcRoundDelete}
          size="sm"
          variant="ghost"
          disabled={isPending || !canDelete}
          loading={isPending}
          onClick={onDelete}
        >
          Delete
        </Button>
      </ExplorerBatchAction>
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

interface ExplorerBatchActionProps {
  /** Why the action is disabled */
  reason?: string
  children: ReactNode
}

// A disabled button gets no pointer events, so the reason is the title of
// the element around it
function ExplorerBatchAction({reason, children}: ExplorerBatchActionProps) {
  return (
    <span className={styles.ExplorerBatchActionBar.action()} title={reason}>
      {children}
    </span>
  )
}
