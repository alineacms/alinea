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
  type DashboardOptions
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
import {
  discardMutationQueueAtom,
  mutationQueueAtom,
  retryMutationQueueAtom,
  uploadProgressAtom
} from './MutationAtoms.js'
import {navigationAtoms, routeAtom} from './NavigationAtoms.js'
import {
  createDashboardNavigation,
  entrySidebarOpenAtom,
  entrySidebarTabAtom,
  pageAtom,
  refreshPageForAtom,
  reloadPageAtom
} from './PageAtoms.js'
import {
  canManageMembersAtom,
  policyAtom,
  policyReadyAtom
} from './PolicyAtoms.js'
import {
  markPreviewSessionReadyAtom,
  previewMetadataAtom,
  previewSessionOriginsAtom
} from './PreviewAtoms.js'
import {entryRevisionAtom} from './RevisionAtom.js'
import {
  selectedRootAtom,
  selectedWorkspaceAtom,
  workspacesAtom
} from './SelectionAtoms.js'
import {shaAtom, syncAtom} from './SyncAtoms.js'
import {viewAtom} from './ViewAtom.js'
import {
  currentRootAtom,
  currentWorkspaceAtom,
  selectedMediaRootAtom,
  workspaceAtoms
} from './WorkspaceAtoms.js'

export type {DashboardRoute, Route, RouteUpdate} from '../DashboardNav.js'
export type {DashboardCreateEntryRequest} from './CreateEntryAtom.js'

export const dashboardAtoms = {
  graph: graphAtom,
  config: configAtom,
  client: clientAtom,
  events: eventsAtom,
  db: graphAtom,

  entrySidebarTab: entrySidebarTabAtom,
  entrySideBarOpen: entrySidebarOpenAtom,
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

export type Dashboard = typeof dashboardAtoms & {
  input?: DashboardInput
}

export type Store = Dashboard

export {createDashboardNavigation}

export function createStore(
  graph: WriteableGraph,
  config: Config,
  events: EventTarget,
  client: LocalConnection,
  views: Record<string, ComponentType>,
  options: DashboardOptions = {}
): Dashboard {
  return Object.assign(Object.create(dashboardAtoms) as Dashboard, {
    input: {graph, config, events, client, views, options}
  })
}
