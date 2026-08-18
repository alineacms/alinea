import {Button} from '#/components.js'
import {
  createExplorerAtoms,
  type ExplorerLocation,
  type ExplorerOptions
} from '#/dashboard/atoms/explorer.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import {useDashboardContext} from '#/dashboard/hooks.js'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {Suspense, startTransition, useState} from 'react'
import {ExplorerHeader} from './Explorer.js'
import {
  ExplorerModal,
  ExplorerModalActions,
  ExplorerModalFooter,
  ExplorerModalSelection,
  ExplorerModalSuspense
} from './ExplorerModal.js'
import {
  explorerTree,
  ExplorerPickerContent,
  normalizePickerLocale
} from './ExplorerPickerContent.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  useDashboardModal
} from './ui/DashboardModal.js'

export interface LinkPickerOptions extends ExplorerOptions {}

export function LinkPicker(options: LinkPickerOptions) {
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
  options: LinkPickerOptions
}

function LinkPickerModalContent({options}: ExplorerModalProps) {
  const modal = useDashboardModal()
  const {page, root} = useDashboardContext()
  const location = options.location ?? {
    workspace: root.workspace,
    root: root.key
  }
  const pickerRoot = rootAtoms(location.workspace, location.root ?? root.key)
  const pickerI18n = useAtomValue(pickerRoot.i18n)
  const initialLocale = normalizePickerLocale(
    location.locale ?? options.selectedLocale ?? page.locale,
    pickerI18n?.locales ?? []
  )
  const initialLocation = {...location, locale: initialLocale ?? undefined}
  const [explorer] = useState(() => {
    let explorer: ReturnType<typeof createExplorerAtoms>
    const currentRoot = (location: ExplorerLocation) =>
      rootAtoms(location.workspace, location.root ?? root.key)
    const rootData = atom(get => get(currentRoot(get(explorer.location)).data))
    explorer = createExplorerAtoms(initialLocation, {
      ...options,
      allowAllWorkspaces:
        options.allowAllWorkspaces ??
        (!options.limitLocations?.length && !options.pickChildren),
      initialView: options.initialView ?? 'row',
      rootData,
      searchDepth: 'all',
      selectedLocale: initialLocale,
      treeItems: (locale, location) =>
        explorerTree(currentRoot(location), explorer, locale, location).items,
      treeReady: (locale, location) =>
        explorerTree(currentRoot(location), explorer, locale, location).ready
    })
    return explorer
  })
  const selectedLocale = useAtomValue(explorer.selectedLocale)
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
            autoFocusSearch
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
            navigate
            locale={selectedLocale}
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
