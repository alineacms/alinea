import {
  Button,
  type Key,
  type Selection,
  Text,
  useDialog
} from '#/components.js'
import {atom, useAtomValueRaw, useSetAtom} from 'jotai'
import {startTransition, useMemo} from 'react'
import {
  createExplorerAtoms,
  type DashboardEntry,
  type DashboardExplorer,
  type ExplorerLocation,
  type ExplorerOptions,
  type ExplorerReadyPage,
  type ExplorerView
} from '../atoms/explorer.js'
import {rootAtoms} from '../atoms/root.js'
import {dispense} from '../atoms/utils.js'
import {useDashboardContext} from '../hooks.js'
import {ExplorerBody} from './Explorer.js'
import {
  ExplorerModalActions,
  ExplorerModalContent,
  ExplorerModalFooter,
  ExplorerModalNavigation
} from './ExplorerModal.js'
import {SidebarTreeExplorer} from './SidebarTree.js'

export function createExplorerTree(explorer: () => DashboardExplorer) {
  return dispense(
    (
      root: ReturnType<typeof rootAtoms>,
      locale: string | null,
      location?: ExplorerLocation
    ) => {
      const current = explorer()
      return root.createTree(
        locale,
        atom(get => {
          const parentId = location
            ? location.parentId
            : get(current.location).parentId
          return parentId ? new Set<Key>([parentId]) : new Set<Key>()
        }),
        current.sidebarExpandedKeys
      )
    }
  )
}

/**
 * The explorer of a picker opened at `location`, it starts over when the
 * location or condition changes
 */
export function usePickerExplorer(
  options: ExplorerOptions,
  location: ExplorerLocation,
  initialView: ExplorerView
) {
  const {page, root} = useDashboardContext()
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
  return useMemo(() => {
    let explorer: DashboardExplorer
    const tree = createExplorerTree(() => explorer)
    const currentRoot = (location: ExplorerLocation) =>
      rootAtoms(location.workspace, location.root ?? root.key)
    const rootData = atom(get => get(currentRoot(get(explorer.location)).data))
    explorer = createExplorerAtoms(initialLocation, {
      ...options,
      allowAllWorkspaces:
        options.allowAllWorkspaces ??
        (!options.limitLocations?.length && !options.pickChildren),
      initialView: options.initialView ?? initialView,
      rootData,
      selectedLocale: initialLocale,
      treeItems: (locale, location) =>
        tree(currentRoot(location), locale, location).items,
      treeReady: (locale, location) =>
        tree(currentRoot(location), locale, location).ready
    })
    return {explorer, tree}
  }, [explorerIdentity])
  // oxlint-enable react-hooks/exhaustive-deps
}

export interface ExplorerPickerFooterProps {
  explorer: DashboardExplorer
  onSubmit: () => void
}

/** Counts the selected entries and confirms or cancels the picker */
export function ExplorerPickerFooter({
  explorer,
  onSubmit
}: ExplorerPickerFooterProps) {
  const modal = useDialog()
  const selection = useAtomValueRaw(explorer.selection)
  const selectedItems = selection === 'all' ? 0 : selection.size
  return (
    <ExplorerModalFooter>
      <Text color="muted">
        {selectedItems} {selectedItems === 1 ? 'item' : 'items'} selected
      </Text>
      <ExplorerModalActions>
        <Button onClick={modal.close}>Cancel</Button>
        <Button color="primary" onClick={onSubmit}>
          Select
        </Button>
      </ExplorerModalActions>
    </ExplorerModalFooter>
  )
}

export interface ExplorerPickerContentProps {
  explorer: DashboardExplorer
  navigationLabel: string
  /** Picks a single entry as soon as it is clicked */
  onPick?: (entry: DashboardEntry) => void
  options: {pickChildren?: boolean}
  page: ExplorerReadyPage
  tree: ReturnType<typeof createExplorerTree>
}

export function ExplorerPickerContent({
  explorer,
  navigationLabel,
  onPick,
  options,
  page,
  tree
}: ExplorerPickerContentProps) {
  const {location, view} = page
  const setLocation = useSetAtom(explorer.location)
  const root = location.root
    ? rootAtoms(location.workspace, location.root)
    : undefined
  const showNavigation =
    !options.pickChildren && !explorer.limitLocations?.length

  function onRootPress() {
    startTransition(() => {
      setLocation(current => ({...current, parentId: undefined}))
    })
  }

  function onSelectionChange(keys: Selection) {
    if (keys === 'all') return
    const [selected] = keys
    startTransition(() => {
      setLocation(current => ({
        ...current,
        parentId: selected ? String(selected) : undefined
      }))
    })
  }

  return (
    <ExplorerModalContent>
      {showNavigation &&
        view === 'card' &&
        page.resultMode === 'browse' &&
        !page.searchesEverything &&
        root && (
          <ExplorerPickerNavigation
            explorer={explorer}
            navigationLabel={navigationLabel}
            page={page}
            root={root}
            rootSelected={!location.parentId}
            tree={tree}
            onRootPress={onRootPress}
            onSelectionChange={onSelectionChange}
          />
        )}
      <ExplorerBody explorer={explorer} onPick={onPick} page={page} />
    </ExplorerModalContent>
  )
}

interface ExplorerPickerNavigationProps {
  explorer: DashboardExplorer
  navigationLabel: string
  onRootPress: () => void
  onSelectionChange: (keys: Selection) => void
  page: ExplorerReadyPage
  root: ReturnType<typeof rootAtoms>
  rootSelected: boolean
  tree: ReturnType<typeof createExplorerTree>
}

export function normalizePickerLocale(
  locale: string | null | undefined,
  locales: ReadonlyArray<string>
) {
  if (locale && locales.includes(locale)) return locale
  return locales[0] ?? null
}

function ExplorerPickerNavigation({
  explorer,
  navigationLabel,
  onRootPress,
  onSelectionChange,
  page,
  root,
  rootSelected,
  tree
}: ExplorerPickerNavigationProps) {
  const readyLocale = useMemo(
    () =>
      atom(
        () => page.locale,
        (_get, set, locale: string) => set(explorer.selectedLocale, locale)
      ),
    [explorer, page.locale]
  )
  const treeAtoms = tree(root, page.locale, page.location)
  return (
    <ExplorerModalNavigation>
      <SidebarTreeExplorer
        ariaLabel={navigationLabel}
        root={root}
        rootSelected={rootSelected}
        selectedLocale={readyLocale}
        tree={treeAtoms}
        onRootPress={onRootPress}
        onSelectionChange={onSelectionChange}
      />
    </ExplorerModalNavigation>
  )
}
