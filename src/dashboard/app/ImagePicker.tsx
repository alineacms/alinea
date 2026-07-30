import {useAtomValue} from '../AtomHooks.js'
import {AtomSnapshot} from '../AtomSnapshot.js'
// oxlint-disable jsx_a11y/no-autofocus
import {Button} from '#/components.js'
import {useSetAtom} from 'jotai'
import {useState, type ReactNode} from 'react'
import {createExplorerAtoms, type ExplorerOptions} from '../atoms/explorer.js'
import {selectedWorkspaceAtom} from '../atoms/routing.js'
import {selectedMediaRootAtom} from '../atoms/config.js'
import {ExplorerHeader} from './Explorer.js'
import {
  ExplorerModal,
  ExplorerModalActions,
  ExplorerModalFooter,
  ExplorerModalSelection
} from './ExplorerModal.js'
import {
  createExplorerPickerSnapshot,
  ExplorerPickerContent
} from './ExplorerPickerContent.js'
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
      <ImagePickerModalContent options={options} label={label} />
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
  const [{explorer, snapshot, tree}] = useState(() => {
    const explorer = createExplorerAtoms(location, {
      ...options,
      flatResults: false,
      searchDepth: 'all'
    })
    return {
      explorer,
      ...createExplorerPickerSnapshot(explorer, location.workspace)
    }
  })
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size

  function onSubmit() {
    onConfirm()
    modal.close()
  }

  return (
    <DashboardModalDialog aria-label={label} variant="explorer">
      <AtomSnapshot atom={snapshot}>
        {prepared => (
          <ExplorerModal>
            <ExplorerHeader
              controls={<DashboardModalCloseButton />}
              explorer={explorer}
              items={prepared.items}
            />
            <ExplorerPickerContent
              explorer={explorer}
              items={prepared.items}
              navigationLabel="Media folders"
              options={options}
              preparedTree={prepared.preparedTree}
              tree={tree}
            />
            <ExplorerModalFooter>
              <ExplorerModalSelection>
                {selectedItems} {selectedItems === 1 ? 'item' : 'items'}{' '}
                selected
              </ExplorerModalSelection>
              <ExplorerModalActions>
                <Button onPress={modal.close}>Cancel</Button>
                <Button intent="primary" onPress={onSubmit}>
                  Select
                </Button>
              </ExplorerModalActions>
            </ExplorerModalFooter>
          </ExplorerModal>
        )}
      </AtomSnapshot>
    </DashboardModalDialog>
  )
}
