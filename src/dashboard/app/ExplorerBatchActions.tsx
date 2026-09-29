import {Button, PageFooter, Text, Toolbar} from '#/components.js'
import {MediaFile, MediaLibrary} from '#/core/media/MediaTypes.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import type {
  DashboardExplorer,
  ExplorerItemData
} from '#/dashboard/atoms/explorer.js'
import {loadMoveTreeAtom, type MoveTree} from '#/dashboard/atoms/move.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useAtomValueRawSync, useSetAtom} from 'jotai'
import {useState, useTransition} from 'react'
import {IcRoundClose, IcRoundDelete, IcRoundDriveFileMove} from '../icons.js'
import css from './ExplorerBatchActions.module.css'
import {MoveDialog} from './MoveDialog.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

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
  const deleteSelection = useSetAtom(explorer.deleteSelection)
  const loadMoveTree = useSetAtom(loadMoveTreeAtom)
  const [moveTree, setMoveTree] = useState<MoveTree>()
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  return (
    <>
      <ExplorerBatchActionBar
        count={items.length}
        canDelete={canDelete}
        canMove={canMove}
        isPending={isPending}
        onClear={clearSelection}
        onDelete={() => setConfirmDelete(true)}
        onMove={openMoveDialog}
      />
      <MoveDialog
        tree={moveTree}
        onClose={() => setMoveTree(undefined)}
        onMoved={clearSelection}
      />
      <ExplorerDeleteDialog
        items={items}
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteSelection()}
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

export interface ExplorerDeleteDialogProps {
  items: Array<ExplorerItemData>
  open: boolean
  onClose(): void
  onConfirm(): Promise<void>
}

/** Asks to confirm deleting the selected entries */
export function ExplorerDeleteDialog({
  items,
  open,
  onClose,
  onConfirm
}: ExplorerDeleteDialogProps) {
  const config = useAtomValueRaw(configAtom)
  const [isPending, startTransition] = useTransition()
  const count = items.length
  const [first] = items
  const files = items.filter(item => config.schema[item.type] === MediaFile)
  const folders = items.filter(
    item => config.schema[item.type] === MediaLibrary
  )
  const parents = items.filter(
    item => item.hasChildren && config.schema[item.type] !== MediaLibrary
  )
  const subject =
    count === 1 && first ? `"${first.title}"` : `${count} selected items`

  function confirm() {
    startTransition(async () => {
      await onConfirm()
      onClose()
    })
  }

  return (
    <DashboardModal
      open={open}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
    >
      <DashboardModalDialog
        label={count === 1 ? 'Delete item?' : `Delete ${count} items?`}
      >
        <DashboardModalContent>
          <Text as="p">{subject} will be deleted. This can not be undone.</Text>
          {files.length > 0 && (
            <Text as="p">
              {files.length === 1
                ? 'The file is removed from the media library and its storage.'
                : `${files.length} files are removed from the media library and its storage.`}
            </Text>
          )}
          {folders.length > 0 && (
            <Text as="p">
              {folders.length === 1
                ? 'The folder is deleted with every file in it.'
                : `${folders.length} folders are deleted with every file in them.`}
            </Text>
          )}
          {parents.length > 0 && (
            <Text as="p">
              Entries are deleted with the entries they contain.
            </Text>
          )}
        </DashboardModalContent>
        <DashboardModalFooter>
          <div className={styles.ExplorerDeleteDialog.actions()}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="destructive"
              icon={IcRoundDelete}
              disabled={isPending}
              loading={isPending}
              onClick={confirm}
            >
              Delete
            </Button>
          </div>
        </DashboardModalFooter>
      </DashboardModalDialog>
    </DashboardModal>
  )
}
