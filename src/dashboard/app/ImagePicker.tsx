// oxlint-disable jsx_a11y/no-autofocus
import {useDialog} from '#/components.js'
import {getRoot} from '#/core/Internal.js'
import {useAtomValueRaw, useAtomValueRawSync, useSetAtom} from 'jotai'
import {Suspense, startTransition, type ReactNode} from 'react'
import type {DashboardEntry, ExplorerOptions} from '../atoms/explorer.js'
import {policyAtom} from '../atoms/user.js'
import {useDashboardContext} from '../hooks.js'
import {ExplorerHeader} from './Explorer.js'
import {ExplorerModal, ExplorerModalSuspense} from './ExplorerModal.js'
import {
  ExplorerPickerContent,
  ExplorerPickerFooter,
  usePickerExplorer
} from './ExplorerPickerContent.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog
} from './ui/DashboardModal.js'

export interface ImagePickerOptions extends ExplorerOptions {
  label?: ReactNode
}

export function ImagePicker(options: ImagePickerOptions) {
  const label = String(options.label ?? 'Pick media')
  return (
    <DashboardModal size="explorer" aria-label={label}>
      <Suspense
        fallback={<DashboardModalDialog variant="explorer" isLoading />}
      >
        <ImagePickerModalContent options={options} />
      </Suspense>
    </DashboardModal>
  )
}

interface ExplorerModalProps {
  options: ImagePickerOptions
}

function ImagePickerModalContent({options}: ExplorerModalProps) {
  const modal = useDialog()
  const {root, workspace} = useDashboardContext()
  const policy = useAtomValueRaw(policyAtom)
  const mediaRoot = Object.entries(workspace.roots).find(
    ([key, value]) =>
      policy.canRead({workspace: root.workspace, root: key}) &&
      Boolean(getRoot(value).isMediaRoot)
  )?.[0]
  const {explorer, tree} = usePickerExplorer(
    options,
    options.location ?? {
      workspace: root.workspace,
      root: mediaRoot ?? root.key
    },
    'card'
  )
  const explorerPage = useAtomValueRawSync(explorer.page)
  const onConfirm = useSetAtom(explorer.onConfirm)
  const setSelection = useSetAtom(explorer.selection)

  if (!explorerPage)
    return <DashboardModalDialog variant="explorer" isLoading />

  function onSubmit() {
    startTransition(() => {
      onConfirm()
      modal.close()
    })
  }

  // A single file is picked as soon as it is clicked
  function onPick(entry: DashboardEntry) {
    setSelection(new Set([entry.id]))
    onSubmit()
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
            page={explorerPage}
          />
          <ExplorerPickerContent
            explorer={explorer}
            navigationLabel="Media folders"
            onPick={explorer.selectionMode === 'single' ? onPick : undefined}
            options={options}
            page={explorerPage}
            tree={tree}
          />
          <ExplorerPickerFooter explorer={explorer} onSubmit={onSubmit} />
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}
