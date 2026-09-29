import {Button, Text, type Selection} from '#/components.js'
import {
  isCurrentMoveTarget,
  moveEntriesAtom,
  type MoveTree
} from '#/dashboard/atoms/move.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {useTransition} from 'react'
import {IcRoundDriveFileMove} from '../icons.js'
import css from './MoveDialog.module.css'
import {SidebarTreeExplorer} from './SidebarTree.js'
import {
  DashboardModal,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

export interface MoveDialogProps {
  /** The entries to move and where they can go, closed when undefined */
  tree: MoveTree | undefined
  onClose(): void
  /** Called once the entries were moved */
  onMoved?(): void
}

/** Picks a location within the root to move one or more entries to */
export function MoveDialog({tree, onClose, onMoved}: MoveDialogProps) {
  return (
    <DashboardModal
      open={Boolean(tree)}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
    >
      {tree && (
        <MoveDialogContent tree={tree} onClose={onClose} onMoved={onMoved} />
      )}
    </DashboardModal>
  )
}

interface MoveDialogContentProps {
  tree: MoveTree
  onClose(): void
  onMoved?(): void
}

function moveDialogTitle(tree: MoveTree) {
  const {subjects} = tree.targets
  const [first] = subjects
  if (subjects.length === 1 && first) return `Move "${first.title}"`
  return `Move ${subjects.length} items`
}

function MoveDialogContent({tree, onClose, onMoved}: MoveDialogContentProps) {
  const {targets} = tree
  const root = rootAtoms(targets.workspace, targets.root)
  const rootLabel = useAtomValueRaw(root.label)
  const target = useAtomValueRaw(tree.target)
  const selectedItem = useAtomValueRaw(tree.selectedItem)
  const canConfirm = useAtomValueRaw(tree.canConfirm)
  const pick = useSetAtom(tree.pick)
  const setExpandedKeys = useSetAtom(tree.expandedKeys)
  const moveEntries = useSetAtom(moveEntriesAtom)
  const [isPending, startTransition] = useTransition()
  const isEmpty = targets.candidates.length === 0 && !targets.rootAccepts
  const targetLabel =
    target === null ? rootLabel : (selectedItem?.title ?? undefined)
  let status: string
  if (isEmpty) status = 'There is no other location to move to'
  else if (target === undefined) status = 'Pick a location'
  else if (isCurrentMoveTarget(targets, target))
    status = `Already in ${targetLabel}`
  else status = `Move to ${targetLabel}`

  function onSelectionChange(keys: Selection) {
    if (keys === 'all') return
    const [key] = keys
    if (key === undefined) return
    const id = String(key)
    if (targets.accepts.has(id)) pick(id)
    // Entries that only hold targets further down open instead
    else setExpandedKeys(current => new Set(current).add(id))
  }

  function confirm() {
    startTransition(async () => {
      await moveEntries(tree)
      onMoved?.()
      onClose()
    })
  }

  return (
    <DashboardModalDialog label={moveDialogTitle(tree)}>
      <div className={styles.MoveDialog()}>
        <SidebarTreeExplorer
          ariaLabel="Move targets"
          root={root}
          rootSelected={target === null}
          selectedLocale={tree.locale}
          tree={tree}
          onRootPress={() => pick(null)}
          onSelectionChange={onSelectionChange}
        />
      </div>
      <DashboardModalFooter>
        <Text color="muted" className={styles.MoveDialog.status()}>
          {status}
        </Text>
        <div className={styles.MoveDialog.actions()}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            icon={IcRoundDriveFileMove}
            disabled={!canConfirm || isPending}
            loading={isPending}
            onClick={confirm}
          >
            Move
          </Button>
        </div>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}
