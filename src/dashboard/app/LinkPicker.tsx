import {Button} from '#/components.js'
import {
  createExplorerAtoms,
  type ExplorerOptions
} from '#/dashboard/atoms/explorer.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import {useDashboardContext} from '#/dashboard/hooks.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {Suspense, startTransition, useState} from 'react'
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

export function LinkPicker(options: ExplorerOptions) {
  return (
    <DashboardModal size="explorer">
      <Suspense
        fallback={
          <DashboardModalDialog
            aria-label="Pick a link"
            variant="explorer"
            isLoading
          />
        }
      >
        <LinkPickerModalContent options={options} />
      </Suspense>
    </DashboardModal>
  )
}

interface ExplorerModalProps {
  options: ExplorerOptions
}

function LinkPickerModalContent({options}: ExplorerModalProps) {
  const modal = useDashboardModal()
  const {page, root} = useDashboardContext()
  const location = options.location ?? {
    workspace: root.workspace,
    root: root.key
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
      policy: page.auth.policy,
      rootData: pickerRoot.data,
      searchDepth: 'all',
      selectedLocale,
      treeItems: pickerRoot.treeItems
    })
  )
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size
  const onSubmit = () => {
    startTransition(() => {
      onConfirm()
      modal.close()
    })
  }
  return (
    <DashboardModalDialog aria-label="Pick a link" variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
          />
          <ExplorerPickerContent
            explorer={explorer}
            navigationLabel="Link folders"
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
