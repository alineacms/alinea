import {Button, DialogTrigger} from '#/components.js'
import type {WorkspaceInternal} from '#/core/Workspace.js'
import type {Page} from '#/dashboard/atoms/nav.js'
import type {RootAtoms} from '#/dashboard/atoms/root.js'
import {styler} from '@alinea/styler'
import {useAtomValue} from 'jotai'
import type {PropsWithChildren} from 'react'
import {DashboardScope} from '../hooks.js'
import {IcRoundAdd} from '../icons.js'
import {AppShell, AppShellContent, AppShellInner} from './AppShell.js'
import {SidebarTree} from './SidebarTree.js'
import {SidebarLayout} from './SidebarLayout.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'
import {WorkspaceRoots} from './WorkspaceRoots.js'
import {CreateEntry} from './modals/CreateEntry.js'
import {DashboardModal} from './ui/DashboardModal.js'
import {Sidebar, SidebarFooter, SidebarHeader} from './ui/Sidebar.js'
import css from './DashboardLayout.module.css'

const styles = styler(css)

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
            <SidebarLayout
              side="left"
              sidebar={
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
                  <SidebarCreateEntryButton root={root} />
                </Sidebar>
              }
            >
              {children}
            </SidebarLayout>
          </AppShellContent>
        </AppShellInner>
      </AppShell>
    </DashboardScope>
  )
}

interface SidebarCreateEntryButtonProps {
  root: RootAtoms
}

function SidebarCreateEntryButton({root}: SidebarCreateEntryButtonProps) {
  return (
    <SidebarFooter>
      <CreateEntryButton root={root} />
    </SidebarFooter>
  )
}

export interface CreateEntryButtonProps {
  root: RootAtoms
  toolbar?: boolean
}

export function CreateEntryButton({
  root,
  toolbar = false
}: CreateEntryButtonProps) {
  const canCreate = useAtomValue(root.canCreate)
  if (!canCreate) return null
  return (
    <DialogTrigger>
      <Button
        aria-label="Create new"
        className={styles.DashboardLayout.create({toolbar})}
        icon={IcRoundAdd}
        intent={toolbar ? 'primary' : 'secondary'}
      >
        Create new
      </Button>
      <DashboardModal>
        <CreateEntry />
      </DashboardModal>
    </DialogTrigger>
  )
}
