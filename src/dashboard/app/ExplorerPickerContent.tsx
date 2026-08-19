import {rootAtoms} from '#/dashboard/atoms/root.js'
import {atom, useSetAtom} from 'jotai'
import {startTransition, useMemo} from 'react'
import type {Key, Selection} from 'react-aria-components'
import type {
  DashboardExplorer,
  ExplorerLocation,
  ExplorerReadyPage
} from '../atoms/explorer.js'
import {dispense} from '../atoms/utils.js'
import {ExplorerBody} from './Explorer.js'
import {ExplorerModalContent, ExplorerModalNavigation} from './ExplorerModal.js'
import {SidebarTreeExplorer} from './SidebarTree.js'

export const explorerTree = dispense(
  (
    root: ReturnType<typeof rootAtoms>,
    explorer: DashboardExplorer,
    locale: string | null,
    location?: ExplorerLocation
  ) =>
    root.createTree(
      locale,
      atom(get => {
        const parentId = location
          ? location.parentId
          : get(explorer.location).parentId
        return parentId ? new Set<Key>([parentId]) : new Set<Key>()
      })
    )
)

export interface ExplorerPickerContentProps {
  explorer: DashboardExplorer
  navigationLabel: string
  options: {pickChildren?: boolean}
  page: ExplorerReadyPage
}

export function ExplorerPickerContent({
  explorer,
  navigationLabel,
  options,
  page
}: ExplorerPickerContentProps) {
  const {location, view} = page
  const setLocation = useSetAtom(explorer.location)
  const root = location.root
    ? rootAtoms(location.workspace, location.root)
    : undefined
  const showNavigation = !options.pickChildren

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
            onRootPress={onRootPress}
            onSelectionChange={onSelectionChange}
          />
        )}
      <ExplorerBody explorer={explorer} page={page} />
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
  rootSelected
}: ExplorerPickerNavigationProps) {
  const readyLocale = useMemo(
    () =>
      atom(
        () => page.locale,
        (_get, set, locale: string) => set(explorer.selectedLocale, locale)
      ),
    [explorer, page.locale]
  )
  const tree = explorerTree(root, explorer, page.locale, page.location)
  return (
    <ExplorerModalNavigation>
      <SidebarTreeExplorer
        ariaLabel={navigationLabel}
        root={root}
        rootSelected={rootSelected}
        selectedLocale={readyLocale}
        tree={tree}
        onRootPress={onRootPress}
        onSelectionChange={onSelectionChange}
      />
    </ExplorerModalNavigation>
  )
}
