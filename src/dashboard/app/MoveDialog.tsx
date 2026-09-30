import {Button, Text} from '#/components.js'
import {configAtom} from '#/dashboard/atoms/core.js'
import {
  moveEntriesAtom,
  moveTargets,
  type MoveSubject
} from '#/dashboard/atoms/move.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import {policyAtom} from '#/dashboard/atoms/user.js'
import {useAtomValueRaw, useAtomValueRawSync, useSetAtom} from 'jotai'
import {Suspense, useTransition} from 'react'
import {IcRoundDriveFileMove} from '../icons.js'
import {ExplorerHeader} from './Explorer.js'
import {
  ExplorerModal,
  ExplorerModalActions,
  ExplorerModalFooter,
  ExplorerModalSuspense
} from './ExplorerModal.js'
import {
  ExplorerPickerContent,
  usePickerExplorer
} from './ExplorerPickerContent.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog
} from './ui/DashboardModal.js'

export interface MoveDialogProps {
  /** The entries to move, all of one root, closed when undefined */
  subjects: Array<MoveSubject> | undefined
  onClose(): void
  /** Called once the entries were moved */
  onMoved?(): void
}

function moveDialogTitle(subjects: Array<MoveSubject>) {
  const [first] = subjects
  if (subjects.length === 1 && first) return `Move "${first.title}"`
  return `Move ${subjects.length} items`
}

/** Picks an entry of the root, or its top level, to move entries to */
export function MoveDialog({subjects, onClose, onMoved}: MoveDialogProps) {
  return (
    <DashboardModal
      open={Boolean(subjects)}
      size="explorer"
      aria-label={subjects && moveDialogTitle(subjects)}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
    >
      {subjects && (
        <Suspense
          fallback={<DashboardModalDialog variant="explorer" isLoading />}
        >
          <MoveDialogContent
            subjects={subjects}
            onClose={onClose}
            onMoved={onMoved}
          />
        </Suspense>
      )}
    </DashboardModal>
  )
}

interface MoveDialogContentProps {
  subjects: Array<MoveSubject>
  onClose(): void
  onMoved?(): void
}

function MoveDialogContent({
  subjects,
  onClose,
  onMoved
}: MoveDialogContentProps) {
  const [{workspace, root, locale, parentId}] = subjects as [MoveSubject]
  const config = useAtomValueRaw(configAtom)
  const policy = useAtomValueRaw(policyAtom)
  const rootData = useAtomValueRaw(rootAtoms(workspace, root).data)
  const targets = moveTargets(config, policy, rootData, subjects)
  // Opens at the current location, other roots are not a target
  const {explorer, tree} = usePickerExplorer(
    {
      canSelect: targets.canSelect,
      condition: targets.condition,
      initialResultMode: 'browse',
      limitLocations: [{workspace, root}],
      nestedNavigation: true
    },
    {
      workspace,
      root,
      parentId: parentId ?? undefined,
      locale: locale ?? undefined
    },
    'row'
  )
  const page = useAtomValueRawSync(explorer.page)
  const selection = useAtomValueRaw(explorer.selection)
  const moveEntries = useSetAtom(moveEntriesAtom)
  const [isPending, startTransition] = useTransition()
  if (!page) return <DashboardModalDialog variant="explorer" isLoading />
  const [target] = selection === 'all' ? [] : selection

  function moveTo(target: string | null) {
    startTransition(async () => {
      await moveEntries(subjects, target)
      onMoved?.()
      onClose()
    })
  }

  return (
    <DashboardModalDialog variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            autoFocusSearch
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
            navigate
            page={page}
          />
          <ExplorerPickerContent
            explorer={explorer}
            navigationLabel="Move targets"
            options={{}}
            page={page}
            tree={tree}
          />
          <ExplorerModalFooter>
            <Text color="muted">{moveDialogTitle(subjects)}</Text>
            <ExplorerModalActions>
              {targets.rootAccepts && (
                <Button
                  variant="ghost"
                  disabled={
                    isPending ||
                    subjects.every(subject => subject.parentId === null)
                  }
                  onClick={() => moveTo(null)}
                >
                  Move to root
                </Button>
              )}
              <Button onClick={onClose}>Cancel</Button>
              <Button
                color="primary"
                icon={IcRoundDriveFileMove}
                disabled={target === undefined || isPending}
                loading={isPending}
                onClick={() => moveTo(String(target))}
              >
                Move
              </Button>
            </ExplorerModalActions>
          </ExplorerModalFooter>
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}
