import {
  Button,
  Popover,
  PopoverAnchor,
  PopoverContent,
  type Selection,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useDialog
} from '#/components.js'
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
import {atom, useAtomValueRaw, useSetAtom} from 'jotai'
import {
  Suspense,
  useMemo,
  useState,
  type ReactNode,
  type RefObject
} from 'react'
import {IcRoundOpenInFull} from '../icons.js'
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
  DashboardModalDialog
} from './ui/DashboardModal.js'

const styles = styler(css)
const expandedPickerLabel = 'Pick a link in expanded view'

export interface LinkPickerOptions extends ExplorerOptions {}

export interface LinkPickerProps extends LinkPickerOptions {
  anchorRef?: RefObject<Element | null>
}

export function LinkPicker({anchorRef, ...options}: LinkPickerProps) {
  const dialog = useDialog()
  const [expanded, setExpanded] = useState(false)
  if (!dialog.open && !expanded) return null
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

export function LinkPickerModal(options: LinkPickerOptions) {
  return (
    <DashboardModal size="explorer" aria-label={expandedPickerLabel}>
      <Suspense fallback={<LinkPickerModalLoading />}>
        <LinkPickerModalContent options={options} />
      </Suspense>
    </DashboardModal>
  )
}

function LinkPickerModalLoading() {
  return <DashboardModalDialog variant="explorer" isLoading />
}

interface LinkPickerModalContentProps {
  options: LinkPickerOptions
}

function LinkPickerModalContent({options}: LinkPickerModalContentProps) {
  const {explorer, tree} = useLinkPickerExplorer(options)
  const page = useAtomValueRaw(explorer.page)
  if (!page) return <LinkPickerModalLoading />
  return (
    <LinkPickerExpanded
      explorer={explorer}
      options={options}
      page={page}
      tree={tree}
    />
  )
}

interface LinkPickerPopoverProps {
  anchorRef?: RefObject<Element | null>
  children: ReactNode
}

/** The compact picker opens with the surrounding Dialog, next to the anchor */
function LinkPickerPopover({anchorRef, children}: LinkPickerPopoverProps) {
  const dialog = useDialog()
  return (
    <Popover
      open={dialog.open}
      onOpenChange={open => {
        if (!open) dialog.close()
      }}
    >
      {anchorRef && <PopoverAnchor virtualRef={anchorRef} />}
      <PopoverContent
        aria-label="Pick a link"
        className={styles.LinkPicker.popover()}
        side="bottom"
      >
        {children}
      </PopoverContent>
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
    <DashboardModal
      open
      size="explorer"
      aria-label={expandedPickerLabel}
      onOpenChange={onExpandedChange}
    >
      <LinkPickerModalLoading />
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
  const page = useAtomValueRaw(explorer.page)
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
        open={expanded}
        size="explorer"
        aria-label={expandedPickerLabel}
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
  const pickerI18n = useAtomValueRaw(pickerRoot.i18n)
  const initialLocale = normalizePickerLocale(
    location.locale ?? options.selectedLocale ?? page.locale,
    pickerI18n?.locales ?? []
  )
  const initialLocation = {...location, locale: initialLocale ?? undefined}
  const explorerIdentity = JSON.stringify([
    initialLocation,
    options.condition ?? null
  ])
  // Explorer atoms capture their initial options and reset only with this scope.
  // oxlint-disable react-hooks/exhaustive-deps
  const picker = useMemo(() => {
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
  }, [explorerIdentity])
  // oxlint-enable react-hooks/exhaustive-deps
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
  const popover = useDialog()
  const selection = useAtomValueRaw(explorer.selection)
  const setSelection = useSetAtom(explorer.selection)
  const selectsMultiple = explorer.selectionMode === 'multiple'
  const selectedItems = selection === 'all' ? 0 : selection.size

  function commitSelection(selection: Selection) {
    if (
      selection === 'all' ||
      (selection.size === 0 && explorer.selectionMode !== 'multiple')
    )
      return
    onCommit?.([...selection].map(String), page.locale)
    popover.close()
  }

  function commitEntry(entry: DashboardEntry) {
    if (selectsMultiple) {
      const nextSelection =
        selection === 'all' ? new Set<string>() : new Set(selection)
      if (nextSelection.has(entry.id)) nextSelection.delete(entry.id)
      else nextSelection.add(entry.id)
      setSelection(nextSelection)
      return
    }
    const nextSelection = new Set([entry.id])
    setSelection(nextSelection)
    commitSelection(nextSelection)
  }

  function openExpanded() {
    onExpand()
    popover.close()
  }

  return (
    <div className={styles.LinkPickerCompact()}>
      <div className={styles.LinkPickerCompact.header()}>
        <ExplorerSearch
          autoFocus
          explorer={explorer}
          onEntryAction={commitEntry}
          page={page}
        />
        <Tooltip>
          <TooltipTrigger
            aria-label="Expand entry picker"
            variant="ghost"
            icon={IcRoundOpenInFull}
            size="icon-lg"
            onClick={openExpanded}
          />
          <TooltipContent>Expand entry picker</TooltipContent>
        </Tooltip>
      </div>
      <ExplorerBody
        compactTable
        explorer={explorer}
        onSelectionChange={selectsMultiple ? undefined : commitSelection}
        page={page}
      />
      {selectsMultiple && (
        <div className={styles.LinkPickerCompact.footer()}>
          <span className={styles.LinkPickerCompact.selection()}>
            {selectedItems} {selectedItems === 1 ? 'item' : 'items'} selected
          </span>
          <Button color="primary" onClick={() => commitSelection(selection)}>
            Select
          </Button>
        </div>
      )}
    </div>
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
  const modal = useDialog()
  const onConfirm = useSetAtom(explorer.onConfirm)
  const selection = useAtomValueRaw(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size

  function onSubmit() {
    onConfirm(page.locale)
    modal.close()
  }

  return (
    <DashboardModalDialog variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            autoFocusSearch
            canBrowse={options.enableNavigation !== false}
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
              <Button onClick={modal.close}>Cancel</Button>
              <Button color="primary" onClick={onSubmit}>
                Select
              </Button>
            </ExplorerModalActions>
          </ExplorerModalFooter>
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}
