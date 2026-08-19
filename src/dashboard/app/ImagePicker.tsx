// oxlint-disable jsx_a11y/no-autofocus
import {Button} from '#/components.js'
import {getRoot} from '#/core/Internal.js'
import {
  createExplorerAtoms,
  type ExplorerLocation,
  type ExplorerOptions
} from '#/dashboard/atoms/explorer.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import {policyAtom} from '#/dashboard/atoms/user.js'
import {useDashboardContext} from '#/dashboard/hooks.js'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {Suspense, startTransition, useState, type ReactNode} from 'react'
import {ExplorerHeader} from './Explorer.js'
import {
  ExplorerModal,
  ExplorerModalActions,
  ExplorerModalFooter,
  ExplorerModalSelection,
  ExplorerModalSuspense
} from './ExplorerModal.js'
import {
  createExplorerTree,
  ExplorerPickerContent,
  normalizePickerLocale
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
  const policy = useAtomValue(policyAtom)
  const mediaRoot = Object.entries(workspace.roots).find(
    ([key, value]) =>
      policy.canRead({workspace: root.workspace, root: key}) &&
      Boolean(getRoot(value).isMediaRoot)
  )?.[0]
  const location = options.location ?? {
    workspace: root.workspace,
    root: mediaRoot ?? root.key
  }
  const pickerRoot = rootAtoms(location.workspace, location.root ?? root.key)
  const pickerI18n = useAtomValue(pickerRoot.i18n)
  const initialLocale = normalizePickerLocale(
    location.locale ?? options.selectedLocale ?? page.locale,
    pickerI18n?.locales ?? []
  )
  const initialLocation = {...location, locale: initialLocale ?? undefined}
  const [{explorer, tree}] = useState(() => {
    let explorer: ReturnType<typeof createExplorerAtoms>
    const tree = createExplorerTree(() => explorer)
    const currentRoot = (location: ExplorerLocation) =>
      rootAtoms(location.workspace, location.root ?? root.key)
    const rootData = atom(get => get(currentRoot(get(explorer.location)).data))
    explorer = createExplorerAtoms(initialLocation, {
      ...options,
      allowAllWorkspaces:
        options.allowAllWorkspaces ??
        (!options.limitLocations?.length && !options.pickChildren),
      initialView: options.initialView ?? 'card',
      rootData,
      searchDepth: 'all',
      selectedLocale: initialLocale,
      treeItems: (locale, location) =>
        tree(currentRoot(location), locale, location).items,
      treeReady: (locale, location) =>
        tree(currentRoot(location), locale, location).ready
    })
    return {explorer, tree}
  })
  const explorerPage = useAtomValue(explorer.page)
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValue(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size

  if (!explorerPage)
    return (
      <DashboardModalDialog aria-label={label} variant="explorer" isLoading />
    )

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
            autoFocusSearch
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
            navigate
            page={explorerPage}
          />
          <ExplorerPickerContent
            explorer={explorer}
            navigationLabel="Media folders"
            options={options}
            page={explorerPage}
            tree={tree}
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
