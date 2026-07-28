import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {User} from '#/core/User.js'
import {assert} from '#/core/util/Assert.js'
import {createStore, Provider, useAtomValue} from 'jotai'
import {useHydrateAtoms} from 'jotai/utils'
import type {PropsWithChildren} from 'react'
import {createElement, useMemo, useState} from 'react'
import type {Dashboard} from './atoms/Dashboard.js'
import {
  clientAtom,
  configAtom,
  createDashboardNavigation,
  currentEntryAtom,
  dashboardAtoms,
  dashboardEffectsAtom,
  eventsAtom,
  graphAtom,
  navigationAtom,
  optionsAtom,
  previewTokenRequestsAtom,
  viewsAtom,
  type DashboardInput
} from './atoms/Dashboard.js'
import {createBrowserHistory} from './atoms/navigation/History.js'

export * from './editor/EditorScope.js'
export * from './editor/FieldHooks.js'

export function DashboardScopeInternal({
  children,
  dashboard
}: PropsWithChildren<{dashboard: Dashboard}>) {
  const [store] = useState(createStore)
  return createElement(
    Provider,
    {store},
    createElement(DashboardHydration, {dashboard}, children)
  )
}

function DashboardHydration({
  children,
  dashboard
}: PropsWithChildren<{dashboard: Dashboard}>) {
  const {input} = dashboard
  assert(input, 'Dashboard input not found')
  useHydrateDashboard(input)
  return children
}

export function useHydrateDashboard(input: DashboardInput) {
  const navigation = useMemo(
    () =>
      createDashboardNavigation(
        input.options.history ?? createBrowserHistory()
      ),
    [input.options.history]
  )
  const previewTokenRequests = useMemo(
    () => new Map<string, Promise<string>>(),
    []
  )
  useHydrateAtoms([
    [graphAtom, input.graph],
    [configAtom, input.config],
    [eventsAtom, input.events],
    [clientAtom, input.client],
    [viewsAtom, input.views],
    [optionsAtom, input.options],
    [navigationAtom, navigation],
    [previewTokenRequestsAtom, previewTokenRequests]
  ] as const)
  useAtomValue(dashboardEffectsAtom)
}

export function useDashboard() {
  return dashboardAtoms
}

export function usePolicy() {
  return useAtomValue(dashboardAtoms.policy)
}

export function useUser(): User | null {
  return useAtomValue(dashboardAtoms.user) ?? null
}

export function useGraph(): WriteableGraph {
  return useAtomValue(dashboardAtoms.db)
}

/**
 * @deprecated Read `currentEntryAtom` directly in dashboard code.
 */
export function useEntry() {
  return useAtomValue(currentEntryAtom)
}
