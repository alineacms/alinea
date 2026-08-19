import {Button, Dialog, Popover} from '#/components.js'
import {
  createExplorerAtoms,
  type DashboardEntry,
  type DashboardExplorer,
  type ExplorerLocation,
  type ExplorerOptions,
  type ExplorerReadyPage
} from '#/dashboard/atoms/explorer.js'
import {rootAtoms} from '#/dashboard/atoms/root.js'
import {useDashboardContext} from '#/dashboard/hooks.js'
import styler from '@alinea/styler'
import {atom, useAtomValue, useSetAtom} from 'jotai'
import {
  Suspense,
  startTransition,
  useState,
  type ReactNode,
  type RefObject
} from 'react'
import type {Selection} from 'react-aria-components'
import {IcRoundOpenInNew} from '../icons.js'
import {ExplorerBody, ExplorerHeader, ExplorerSearch} from './Explorer.js'
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
import css from './LinkPicker.module.css'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog,
  useDashboardModal
} from './ui/DashboardModal.js'

const styles = styler(css)

export interface LinkPickerOptions extends ExplorerOptions {}

export interface LinkPickerProps extends LinkPickerOptions {
  anchorRef?: RefObject<Element | null>
}

export function LinkPicker({anchorRef, ...options}: LinkPickerProps) {
  const trigger = useDashboardModal()
  const [expanded, setExpanded] = useState(false)
  if (!trigger.isOpen && !expanded) return null
  return (
    <Suspense
      fallback={
        <LinkPickerLoading expanded={expanded} onExpandedChange={setExpanded} />
      }
    >
      <LinkPickerReady
        anchorRef={anchorRef}
        expanded={expanded}
        options={options}
        onExpandedChange={setExpanded}
      />
    </Suspense>
  )
}

interface LinkPickerPopoverProps {
  anchorRef?: RefObject<Element | null>
  children: ReactNode
}

function LinkPickerPopover({anchorRef, children}: LinkPickerPopoverProps) {
  return (
    <Popover
      className={styles.LinkPicker.popover()}
      placement="bottom"
      triggerRef={anchorRef}
    >
      {children}
    </Popover>
  )
}

interface LinkPickerLoadingProps {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

function LinkPickerLoading({
  expanded,
  onExpandedChange
}: LinkPickerLoadingProps) {
  if (!expanded) return null
  return (
    <DashboardModal isOpen size="explorer" onOpenChange={onExpandedChange}>
      <DashboardModalDialog
        aria-label="Pick a link in expanded view"
        variant="explorer"
        isLoading
      />
    </DashboardModal>
  )
}

interface LinkPickerReadyProps {
  anchorRef?: RefObject<Element | null>
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  options: LinkPickerOptions
}

function LinkPickerReady({
  anchorRef,
  expanded,
  onExpandedChange,
  options
}: LinkPickerReadyProps) {
  const {explorer, tree} = useLinkPickerExplorer(options)
  const page = useAtomValue(explorer.page)
  if (!page)
    return (
      <LinkPickerLoading
        expanded={expanded}
        onExpandedChange={onExpandedChange}
      />
    )
  return (
    <>
      <LinkPickerPopover anchorRef={anchorRef}>
        <LinkPickerCompact
          explorer={explorer}
          page={page}
          onCommit={options.onConfirm}
          onExpand={() => onExpandedChange(true)}
        />
      </LinkPickerPopover>
      <DashboardModal
        isOpen={expanded}
        size="explorer"
        onOpenChange={onExpandedChange}
      >
        <LinkPickerExpanded
          explorer={explorer}
          options={options}
          page={page}
          tree={tree}
        />
      </DashboardModal>
    </>
  )
}

function useLinkPickerExplorer(options: LinkPickerOptions) {
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
  const [picker] = useState(() => {
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
      initialView: options.initialView ?? 'row',
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
  return picker
}

interface LinkPickerCompactProps {
  explorer: DashboardExplorer
  page: ExplorerReadyPage
  onCommit: LinkPickerOptions['onConfirm']
  onExpand: () => void
}

function LinkPickerCompact({
  explorer,
  page,
  onCommit,
  onExpand
}: LinkPickerCompactProps) {
  const popover = useDashboardModal()
  const setSelection = useSetAtom(explorer.selection)

  function commitSelection(selection: Selection) {
    if (selection === 'all' || selection.size === 0) return
    startTransition(() => {
      onCommit?.([...selection].map(String))
      popover.close()
    })
  }

  function commitEntry(entry: DashboardEntry) {
    const selection = new Set([entry.id])
    setSelection(selection)
    commitSelection(selection)
  }

  function openExpanded() {
    onExpand()
    popover.close()
  }

  return (
    <Dialog aria-label="Pick a link" className={styles.LinkPickerCompact()}>
      <div className={styles.LinkPickerCompact.header()}>
        <ExplorerSearch
          autoFocus
          explorer={explorer}
          onEntryAction={commitEntry}
          page={page}
        />
        <Button
          aria-label="Expand entry picker"
          appearance="plain"
          icon={IcRoundOpenInNew}
          size="icon-nav"
          onPress={openExpanded}
        />
      </div>
      <ExplorerBody
        compactTable
        explorer={explorer}
        onSelectionChange={commitSelection}
        page={page}
      />
    </Dialog>
  )
}

interface LinkPickerExpandedProps {
  explorer: DashboardExplorer
  options: LinkPickerOptions
  page: ExplorerReadyPage
  tree: ReturnType<typeof createExplorerTree>
}

function LinkPickerExpanded({
  explorer,
  options,
  page,
  tree
}: LinkPickerExpandedProps) {
  const modal = useDashboardModal()
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
    <DashboardModalDialog
      aria-label="Pick a link in expanded view"
      variant="explorer"
    >
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
            navigationLabel="Link folders"
            options={options}
            page={page}
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
