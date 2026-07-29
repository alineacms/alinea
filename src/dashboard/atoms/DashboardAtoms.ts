import type {Config} from '#/core/Config.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import type {ComponentType} from 'react'
import {
  authenticateAtom,
  authAtom,
  authRequiredAtom,
  canLogoutAtom,
  currentUserAtom,
  isLocalAtom,
  logoutAtom,
  setUserRolesAtom,
  userAtom
} from './AuthAtoms.js'
import {
  clientAtom,
  configAtom,
  eventsAtom,
  graphAtom,
  type DashboardInput,
  type DashboardOptions,
  viewAtom
} from './CoreAtoms.js'
import {createEntryAtom} from './CreateEntryAtom.js'
import {
  focusedAtom,
  prepareInitialContentAtom,
  themeAtom
} from './DashboardViewAtoms.js'
import {typeAtoms} from './EditorAtoms.js'
import {entryAtoms} from './EntryAtoms.js'
import {entryLoaderAtom, versionLoaderAtom} from './EntryLoaderAtoms.js'
import {createExplorerAtoms} from './ExplorerAtoms.js'
import {createRouteLoader} from './loaders/Route.js'
import {
  discardMutationQueueAtom,
  mutationQueueAtom,
  retryMutationQueueAtom,
  uploadProgressAtom
} from './MutationAtoms.js'
import {navigationAtoms, routeAtom} from './NavigationAtoms.js'
import {
  createDashboardNavigation,
  pageAtom,
  refreshPageForAtom,
  reloadPageAtom
} from './PageAtoms.js'
import {
  canManageMembersAtom,
  policyAtom,
  policyReadyAtom,
  policyResourceAtom
} from './PolicyAtoms.js'
import {
  markPreviewSessionReadyAtom,
  previewMetadataAtom,
  previewSessionOriginsAtom
} from './PreviewAtoms.js'
import {
  entryRevisionAtom,
  entrySidebarOpenAtom,
  entrySidebarTabAtom
} from './EntrySupport.js'
import {
  selectedRootAtom,
  selectedWorkspaceAtom,
  workspacesAtom
} from './SelectionAtoms.js'
import {shaAtom, syncAtom} from './SyncAtoms.js'
import {
  currentRootAtom,
  currentWorkspaceAtom,
  selectedMediaRootAtom,
  workspaceAtoms
} from './WorkspaceAtoms.js'

export type {DashboardRoute, Route, RouteUpdate} from '../DashboardNav.js'
export type {DashboardCreateEntryRequest} from './CreateEntryAtom.js'

export const dashboardRouteLoader = createRouteLoader({
  config: configAtom,
  policy: policyResourceAtom,
  canManageMembers: canManageMembersAtom,
  workspace: workspaceAtoms,
  entry: entryAtoms
})

export const dashboardAtoms = {
  graph: graphAtom,
  config: configAtom,
  client: clientAtom,
  events: eventsAtom,
  db: graphAtom,

  entrySidebarTab: entrySidebarTabAtom,
  entrySidebarOpen: entrySidebarOpenAtom,
  navigation: navigationAtoms,
  route: routeAtom,
  page: pageAtom,
  reloadPage: reloadPageAtom,
  refreshPageFor: refreshPageForAtom,

  previewMetadata: previewMetadataAtom,
  previewSessionOrigins: previewSessionOriginsAtom,
  markPreviewSessionReady: markPreviewSessionReadyAtom,

  revisions: entryRevisionAtom,

  authRequired: authRequiredAtom,
  isLocal: isLocalAtom,
  auth: authAtom,
  user: userAtom,
  currentUser: currentUserAtom,
  setUserRoles: setUserRolesAtom,
  authenticate: authenticateAtom,
  logout: logoutAtom,
  canLogout: canLogoutAtom,

  mutationQueue: mutationQueueAtom,
  retryMutationQueue: retryMutationQueueAtom,
  discardMutationQueue: discardMutationQueueAtom,
  uploadProgress: uploadProgressAtom,

  policyReady: policyReadyAtom,
  canManageMembers: canManageMembersAtom,
  policy: policyAtom,

  prepareInitialContent: prepareInitialContentAtom,
  focused: focusedAtom,

  sha: shaAtom,
  sync: syncAtom,
  theme: themeAtom,

  selectedWorkspace: selectedWorkspaceAtom,
  selectedRoot: selectedRootAtom,
  workspaces: workspacesAtom,
  workspace: workspaceAtoms,
  currentWorkspace: currentWorkspaceAtom,
  selectedMediaRoot: selectedMediaRootAtom,
  currentRoot: currentRootAtom,

  type: typeAtoms,
  view: viewAtom,
  explore: createExplorerAtoms,
  entries: entryAtoms,
  versionLoader: versionLoaderAtom,
  entryLoader: entryLoaderAtom,
  createEntry: createEntryAtom
}

export type DashboardAtoms = typeof dashboardAtoms & {
  input: DashboardInput
}

export {createDashboardNavigation}

export function createDashboard(
  graph: WriteableGraph,
  config: Config,
  events: EventTarget,
  client: LocalConnection,
  views: Record<string, ComponentType>,
  options: DashboardOptions = {}
): DashboardAtoms {
  return {
    ...dashboardAtoms,
    input: {graph, config, events, client, views, options}
  }
}
