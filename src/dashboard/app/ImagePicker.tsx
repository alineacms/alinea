// oxlint-disable jsx_a11y/no-autofocus
import {Button} from '#/components.js'
import {getRoot} from '#/core/Internal.js'
import {
  createExplorerAtoms,
  type ExplorerOptions
} from '#/dashboard/atoms/explorer.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import {useDashboardContext, usePolicy} from '#/dashboard/hooks.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense, startTransition, useState, type ReactNode} from 'react'
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

export interface ImagePickerOptions extends Omit<ExplorerOptions, 'policy'> {
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
  const {page, root, workspace} = useDashboardContext()
  const policy = usePolicy()
  const mediaRoot = Object.entries(workspace.roots).find(
    ([key, value]) =>
      policy.canRead({workspace: root.workspace, root: key}) &&
      Boolean(getRoot(value).isMediaRoot)
  )?.[0]
  const location = options.location ?? {
    workspace: root.workspace,
    root: mediaRoot ?? root.key
  }
  const pickerRoot = rootAtoms(
    page,
    location.workspace,
    location.root ?? root.key,
    options.selectedLocale ?? root.locale
  )
  const selectedLocale = useAtomValue(pickerRoot.selectedLocale)
  const [explorer] = useState(() =>
    createExplorerAtoms(location, {
      ...options,
      policy,
      flatResults: false,
      rootData: pickerRoot.data,
      searchDepth: 'all',
      selectedLocale,
      treeItems: pickerRoot.treeItems
    })
  )
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size

  function onSubmit() {
    startTransition(() => {
      onConfirm()
      modal.close()
    })
  }

  return (
    <DashboardModalDialog aria-label={label} variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
            navigate
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
