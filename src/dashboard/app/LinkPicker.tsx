import {
  Button,
  Popover,
  PopoverAnchor,
  PopoverContent,
  type Selection,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Text,
  useDialog
} from '#/components.js'
import {Permission} from '#/core/Role.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useAtomValueRawSync, useSetAtom} from 'jotai'
import {Suspense, useState, type ReactNode, type RefObject} from 'react'
import type {
  DashboardEntry,
  DashboardExplorer,
  ExplorerOptions,
  ExplorerReadyPage
} from '../atoms/explorer.js'
import {useDashboardContext} from '../hooks.js'
import {IcRoundOpenInFull} from '../icons.js'
import {ExplorerBody, ExplorerHeader, ExplorerSearch} from './Explorer.js'
import {ExplorerModal, ExplorerModalSuspense} from './ExplorerModal.js'
import {
  type createExplorerTree,
  ExplorerPickerContent,
  ExplorerPickerFooter,
  usePickerExplorer
} from './ExplorerPickerContent.js'
import css from './LinkPicker.module.css'
import {SearchBar} from './SearchBar.js'
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
  const page = useAtomValueRawSync(explorer.page)
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
  const page = useAtomValueRawSync(explorer.page)
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
  const {root} = useDashboardContext()
  // Entries can be linked to where they can be explored, without reading them
  return usePickerExplorer(
    {...options, permission: Permission.Explore},
    options.location ?? {workspace: root.workspace, root: root.key},
    'row'
  )
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
      <SearchBar
        controls={
          <Tooltip>
            <TooltipTrigger
              aria-label="Expand entry picker"
              variant="ghost"
              icon={IcRoundOpenInFull}
              size="icon-sm"
              onClick={openExpanded}
            />
            <TooltipContent>Expand entry picker</TooltipContent>
          </Tooltip>
        }
      >
        <ExplorerSearch
          autoFocus
          explorer={explorer}
          onEntryAction={commitEntry}
          page={page}
        />
      </SearchBar>
      <ExplorerBody
        compactTable
        explorer={explorer}
        onPick={selectsMultiple ? undefined : commitEntry}
        page={page}
      />
      {selectsMultiple && (
        <div className={styles.LinkPickerCompact.footer()}>
          <Text color="muted">
            {selectedItems} {selectedItems === 1 ? 'item' : 'items'} selected
          </Text>
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
  const setSelection = useSetAtom(explorer.selection)

  function onSubmit() {
    onConfirm(page.locale)
    modal.close()
  }

  // A single link is picked as soon as it is clicked
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
            canBrowse={options.enableNavigation !== false}
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
            navigate
            page={page}
          />
          <ExplorerPickerContent
            explorer={explorer}
            navigationLabel="Link folders"
            onPick={explorer.selectionMode === 'single' ? onPick : undefined}
            options={options}
            page={page}
            tree={tree}
          />
          <ExplorerPickerFooter explorer={explorer} onSubmit={onSubmit} />
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}
