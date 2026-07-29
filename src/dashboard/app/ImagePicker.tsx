// oxlint-disable jsx_a11y/no-autofocus
import {Button} from '#/components.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense, useState, type ReactNode} from 'react'
import {createExplorerAtoms, type ExplorerOptions} from '../atoms/explorer.js'
import {selectedWorkspaceAtom} from '../atoms/routing/index.js'
import {selectedMediaRootAtom} from '../atoms/workspace.js'
import {ExplorerHeader} from './Explorer.js'
import {
  ExplorerModal,
  ExplorerModalActions,
  ExplorerModalFooter,
  ExplorerModalSelection,
  ExplorerModalSuspense
} from './ExplorerModal.js'
import {ExplorerPickerContent} from './ExplorerPickerContent.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  useDashboardModal
} from './ui/DashboardModal.js'

export interface ImagePickerOptions extends ExplorerOptions {
  label?: ReactNode
}

export function ImagePicker(options: ImagePickerOptions) {
  const label = String(options.label ?? 'Pick media')
  return (
    <DashboardModal size="explorer">
      <Suspense
        fallback={
          <DashboardModalDialog
            aria-label={label}
            variant="explorer"
            isLoading
          />
        }
      >
        <ImagePickerModalContent options={options} label={label} />
      </Suspense>
    </DashboardModal>
  )
}

interface ExplorerModalProps {
  label: string
  options: ImagePickerOptions
}

function ImagePickerModalContent({label, options}: ExplorerModalProps) {
  const modal = useDashboardModal()
  const workspace = useAtomValue(selectedWorkspaceAtom)
  const mediaRoot = useAtomValue(selectedMediaRootAtom)
  const location = options.location ?? {
    workspace,
    root: mediaRoot ?? undefined
  }
  const [explorer] = useState(() =>
    createExplorerAtoms(location, {
      ...options,
      flatResults: false,
      searchDepth: 'all'
    })
  )
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size

  function onSubmit() {
    onConfirm()
    modal.close()
  }

  return (
    <DashboardModalDialog aria-label={label} variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
          />
          <ExplorerPickerContent
            explorer={explorer}
            navigationLabel="Media folders"
            options={options}
          />
          <ExplorerModalFooter>
            <ExplorerModalSelection>
              {selectedItems} {selectedItems === 1 ? 'item' : 'items'} selected
            </ExplorerModalSelection>
            <ExplorerModalActions>
              <Button onPress={modal.close}>Cancel</Button>
              <Button intent="primary" onPress={onSubmit}>
                Select
              </Button>
            </ExplorerModalActions>
          </ExplorerModalFooter>
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}
