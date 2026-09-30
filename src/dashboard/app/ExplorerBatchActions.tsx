import {Button, PageFooter, Text, Toolbar} from '#/components.js'
import {
  deleteEntriesAtom,
  loadDeletePlanAtom,
  type DeletePlan
} from '#/dashboard/atoms/delete.js'
import type {DashboardExplorer} from '#/dashboard/atoms/explorer.js'
import {loadMoveTreeAtom, type MoveTree} from '#/dashboard/atoms/move.js'
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
  locale: string | null
}

/** Acts on the entries selected in an overview */
export function ExplorerBatchActions({
  explorer,
  locale
}: ExplorerBatchActionsProps) {
  const {items, canMove, canDelete} = useAtomValueRawSync(
    explorer.selectionActions
  )
  const clearSelection = useSetAtom(explorer.clearSelection)
  const loadMoveTree = useSetAtom(loadMoveTreeAtom)
  const loadDeletePlan = useSetAtom(loadDeletePlanAtom)
  const deleteEntries = useSetAtom(deleteEntriesAtom)
  const [moveTree, setMoveTree] = useState<MoveTree>()
  const [deletePlan, setDeletePlan] = useState<DeletePlan>()
  const [isPending, startTransition] = useTransition()
  if (items.length === 0) return null

  // The targets load before the dialog opens, the button shows it is busy
  function openMoveDialog() {
    startTransition(async () => {
      const tree = await loadMoveTree(
        items.map(item => ({
          id: item.id,
          title: item.title,
          type: item.type,
          workspace: item.workspace,
          root: item.root,
          locale: item.locale,
          parentId: item.parentId,
          parents: item.parents
        })),
        locale
      )
      setMoveTree(tree)
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
        tree={moveTree}
        onClose={() => setMoveTree(undefined)}
        onMoved={clearSelection}
      />
      <DeleteDialog
        plan={deletePlan}
        onClose={() => setDeletePlan(undefined)}
        onConfirm={async plan => {
          await deleteEntries(plan)
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
