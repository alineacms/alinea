import type {WorkspaceInternal} from '#/core/Workspace.js'
import type {Page} from '#/dashboard/atoms/nav.js'
import type {RootAtoms} from '#/dashboard/atoms/root.js'
import type {PropsWithChildren} from 'react'
import {DashboardScope} from '../hooks.js'
import {AppShell, AppShellContent, AppShellInner} from './AppShell.js'
import {SidebarTree} from './SidebarTree.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'
import {WorkspaceRoots} from './WorkspaceRoots.js'
import {Toast} from './ToastContainer.js'
import {Sidebar, SidebarHeader} from './ui/Sidebar.js'

export interface DashboardLayoutProps extends PropsWithChildren {
  canManageMembers: boolean
  page: Page
  root: RootAtoms
  workspace: WorkspaceInternal & {name: string}
}

export function DashboardLayout({
  canManageMembers,
  children,
  page,
  root,
  workspace
}: DashboardLayoutProps) {
  return (
    <DashboardScope value={{page, root, workspace}}>
      <AppShell>
        <AppShellInner>
          <WorkspaceRoots canManageMembers={canManageMembers} page={page} />
          <AppShellContent>
            <Sidebar>
              <SidebarHeader>
                <WorkspaceMenu
                  canManageMembers={canManageMembers}
                  page={page}
                  root={root}
                  workspace={workspace}
                />
              </SidebarHeader>
              <SidebarTree page={page} root={root} />
            </Sidebar>
            {children}
          </AppShellContent>
          <Toast />
        </AppShellInner>
      </AppShell>
    </DashboardScope>
  )
}
