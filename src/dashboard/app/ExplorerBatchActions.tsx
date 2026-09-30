import {Button, PageFooter, Text, Toolbar} from '#/components.js'
import {
  archiveEntriesAtom,
  deleteEntriesAtom,
  loadDeletePlanAtom,
  type DeletePlan
} from '#/dashboard/atoms/delete.js'
import type {DashboardExplorer} from '#/dashboard/atoms/explorer.js'
import {loadMoveTargetsAtom, type MoveTargets} from '#/dashboard/atoms/move.js'
import styler from '@alinea/styler'
import {useAtomValueRawSync, useSetAtom} from 'jotai'
import {useState, useTransition} from 'react'
import {IcRoundClose, IcRoundDelete, IcRoundDriveFileMove} from '../icons.js'
import {DeleteDialog} from './DeleteDialog.js'
import css from './ExplorerBatchActions.module.css'
import {MoveDialog} from './MoveDialog.js'

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
  const loadDeletePlan = useSetAtom(loadDeletePlanAtom)
  const deleteEntries = useSetAtom(deleteEntriesAtom)
  const archiveEntries = useSetAtom(archiveEntriesAtom)
  const loadMoveTargets = useSetAtom(loadMoveTargetsAtom)
  const [moving, setMoving] = useState<MoveTargets>()
  const [deletePlan, setDeletePlan] = useState<DeletePlan>()
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
      setDeletePlan(await loadDeletePlan(items))
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
    </>
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

/** Shows how many entries are selected and the actions on them */
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
    <PageFooter className={styles.ExplorerBatchActionBar()}>
      <Toolbar
        aria-label="Selected entries"
        className={styles.ExplorerBatchActionBar.toolbar()}
      >
        <Button
          aria-label="Clear selection"
          icon={IcRoundClose}
          size="icon-sm"
          variant="ghost"
          onClick={onClear}
        />
        <Text className={styles.ExplorerBatchActionBar.count()}>
          {count} selected
        </Text>
        <div className={styles.ExplorerBatchActionBar.actions()}>
          {canMove && (
            <Button
              icon={IcRoundDriveFileMove}
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
              disabled={isPending}
              loading={isPending}
              onClick={onDelete}
            >
              Delete
            </Button>
          )}
        </div>
      </Toolbar>
    </PageFooter>
  )
}
