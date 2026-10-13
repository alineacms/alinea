import {
  AppShell,
  AppShellContent,
  Dialog,
  DialogTrigger,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarInset
} from '#/components.js'
import type {WorkspaceInternal} from '#/core/Workspace.js'
import type {Page} from '#/dashboard/atoms/nav.js'
import type {RootAtoms, TreeView} from '#/dashboard/atoms/root.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import type {PropsWithChildren} from 'react'
import {DashboardScope, useDashboardContext} from '../hooks.js'
import {IcRoundAdd} from '../icons.js'
import {SidebarTree} from './SidebarTree.js'
import {SidebarLayout} from './SidebarLayout.js'
import {WorkspaceMenu} from './WorkspaceMenu.js'
import {WorkspaceRoots} from './WorkspaceRoots.js'
import {CreateEntry} from './modals/CreateEntry.js'
import {MoveConfirmDialog} from './MoveConfirmDialog.js'
import {PendingUploadsDialog} from './PendingUploadsDialog.js'
import {DashboardModal} from './ui/DashboardModal.js'
import css from './DashboardLayout.module.css'

const styles = styler(css)

export interface DashboardLayoutProps extends PropsWithChildren {
  canManageMembers: boolean
  page: Page
  root: RootAtoms
  /** The sidebar tree of the page */
  tree: TreeView
  workspace: WorkspaceInternal & {name: string}
}

export function DashboardLayout({
  canManageMembers,
  children,
  page,
  root,
  tree,
  workspace
}: DashboardLayoutProps) {
  return (
    <DashboardScope value={{page, root, workspace}}>
      <AppShell>
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
                <SidebarTree page={page} root={root} view={tree} />
                <SidebarCreateEntryButton root={root} />
              </Sidebar>
            }
          >
            <SidebarInset>{children}</SidebarInset>
          </SidebarLayout>
        </AppShellContent>
      </AppShell>
      <PendingUploadsDialog />
      <MoveConfirmDialog />
    </DashboardScope>
  )
}

interface SidebarCreateEntryButtonProps {
  root: RootAtoms
}

function SidebarCreateEntryButton({root}: SidebarCreateEntryButtonProps) {
  const {page} = useDashboardContext()
  const canCreate = useAtomValueRaw(root.tree(page.locale).canCreate)
  if (!canCreate) return null
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
  const {page} = useDashboardContext()
  const canCreate = useAtomValueRaw(root.tree(page.locale).canCreate)
  if (!canCreate) return null
  return (
    <Dialog>
      <DialogTrigger
        aria-label="Create new"
        className={styles.DashboardLayout.create({toolbar})}
        icon={IcRoundAdd}
        color={toolbar ? 'primary' : 'secondary'}
      >
        Create new
      </DialogTrigger>
      <DashboardModal aria-label="Create entry">
        <CreateEntry />
      </DashboardModal>
    </Dialog>
  )
}
