import {Button, Text} from '#/components.js'
import {
  moveEntriesAtom,
  type MoveSubject,
  type MoveTargets
} from '#/dashboard/atoms/move.js'
import {useAtomValueRawSync, useSetAtom} from 'jotai'
import {Suspense, useState, useTransition} from 'react'
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
  /** Where the entries of one root can move to, closed when undefined */
  targets: MoveTargets | undefined
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
export function MoveDialog({targets, onClose, onMoved}: MoveDialogProps) {
  return (
    <DashboardModal
      open={Boolean(targets)}
      size="explorer"
      aria-label={targets && moveDialogTitle(targets.subjects)}
      onOpenChange={isOpen => {
        if (!isOpen) onClose()
      }}
    >
      {targets && (
        <Suspense
          fallback={<DashboardModalDialog variant="explorer" isLoading />}
        >
          <MoveDialogContent
            targets={targets}
            onClose={onClose}
            onMoved={onMoved}
          />
        </Suspense>
      )}
    </DashboardModal>
  )
}

interface MoveDialogContentProps {
  targets: MoveTargets
  onClose(): void
  onMoved?(): void
}

function MoveDialogContent({
  targets,
  onClose,
  onMoved
}: MoveDialogContentProps) {
  const {subjects} = targets
  const [{workspace, root, locale, parentId}] = subjects as [MoveSubject]
  // Opens at the current location, other roots are not a target and search
  // covers the whole root
  const {explorer, tree} = usePickerExplorer(
    {
      canSelect: targets.canSelect,
      condition: targets.condition,
      initialResultMode: 'browse',
      limitLocations: [{workspace, root}],
      nestedNavigation: true,
      searchDepth: 'all'
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
  // The picked target while it is listed
  const {
    items: [target]
  } = useAtomValueRawSync(explorer.selectionActions)
  const moveEntries = useSetAtom(moveEntriesAtom)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  if (!page) return <DashboardModalDialog variant="explorer" isLoading />
  const isCurrent = (target: string | null) =>
    subjects.every(subject => subject.parentId === target)

  function moveTo(target: string | null) {
    setError(undefined)
    startTransition(async () => {
      try {
        await moveEntries(subjects, target)
      } catch (error) {
        setError(error instanceof Error ? error.message : String(error))
        return
      }
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
            {error ? (
              <Text color="destructive" asChild>
                <span role="alert">{error}</span>
              </Text>
            ) : (
              <Text color="muted">
                {!target
                  ? moveDialogTitle(subjects)
                  : isCurrent(target.id)
                    ? `Already in "${target.title}"`
                    : `Move to "${target.title}"`}
              </Text>
            )}
            <ExplorerModalActions>
              {targets.rootAccepts && (
                <Button
                  variant="ghost"
                  disabled={isPending || isCurrent(null)}
                  onClick={() => moveTo(null)}
                >
                  Move to root
                </Button>
              )}
              <Button variant="outline" color="neutral" onClick={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                icon={IcRoundDriveFileMove}
                disabled={!target || isCurrent(target.id) || isPending}
                loading={isPending}
                onClick={() => target && moveTo(target.id)}
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
