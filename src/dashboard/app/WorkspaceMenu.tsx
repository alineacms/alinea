import {
  Button,
  Dialog,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  useDialog
} from '#/components.js'
import type {WorkspaceInternal} from '#/core/Workspace.js'
import {workspaceAtom, workspacesAtom} from '../atoms/config.js'
import {createExplorerAtoms} from '../atoms/explorer.js'
import {routeAtom, type Page} from '../atoms/nav.js'
import type {RootAtoms} from '../atoms/root.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useAtomValueRawSync, useSetAtom} from 'jotai'
import {Suspense, useState, type ComponentType, type ReactNode} from 'react'
import {
  searchShortcutKeys,
  useSearchShortcut
} from '../hook/UseSearchShortcut.js'
import {IcOutlineSettings, IcRoundSearch, IcRoundUnfoldMore} from '../icons.js'
import {ExplorerBody, ExplorerHeader} from './Explorer.js'
import {logoShapeForeground, logoShapePath} from './LogoShape.js'
import {ExplorerModal, ExplorerModalSuspense} from './ExplorerModal.js'
import {
  DashboardModal,
  DashboardModalCloseButton,
  DashboardModalDialog
} from './ui/DashboardModal.js'
import css from './WorkspaceMenu.module.css'

const styles = styler(css)

interface WorkspaceMenuProps {
  canManageMembers: boolean
  page: Page
  root: RootAtoms
  workspace: WorkspaceInternal & {name: string}
}

interface WorkspaceAvatarProps {
  color: string
  icon?: ComponentType
  label: string
  size?: 'sm'
}

interface WorkspaceSelectorMenuProps {
  ariaLabel: string
  includeUsersLink?: boolean
  label: ReactNode
  page: Page
}

function WorkspaceAvatar({color, icon, label, size}: WorkspaceAvatarProps) {
  return (
    <span
      className={styles.WorkspaceMenu.avatar({sm: size === 'sm'})}
      style={{color: logoShapeForeground(color)}}
    >
      <svg
        aria-hidden
        className={styles.WorkspaceMenu.avatar.shape()}
        viewBox="0 0 36 36"
        preserveAspectRatio="none"
      >
        <path d={logoShapePath} fill={color} />
      </svg>
      {icon ? (
        <Icon icon={icon} className={styles.WorkspaceMenu.avatar.icon()} />
      ) : (
        <span className={styles.WorkspaceMenu.avatar.initial()} aria-hidden>
          {Array.from(label.trim())[0]?.toUpperCase()}
        </span>
      )}
    </span>
  )
}

export {WorkspaceAvatar}

function WorkspaceSelectorMenu({
  ariaLabel,
  includeUsersLink,
  label,
  page
}: WorkspaceSelectorMenuProps) {
  const setRoute = useSetAtom(routeAtom)
  const workspaces = useAtomValueRaw(workspacesAtom)
  if (workspaces.length <= 1 && !includeUsersLink) return label
  const selected = page.type === 'users' ? 'users' : page.workspace!
  function select(key: string) {
    if (key === 'users') {
      setRoute({page: 'users'})
      return
    }
    setRoute({workspace: key, root: undefined})
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{label}</DropdownMenuTrigger>
      <DropdownMenuContent aria-label={ariaLabel}>
        <DropdownMenuRadioGroup value={selected} onValueChange={select}>
          {workspaces.map(workspace => (
            <WorkspaceItem key={workspace} workspace={workspace} />
          ))}
        </DropdownMenuRadioGroup>
        {includeUsersLink && <DropdownMenuSeparator />}
        {includeUsersLink && (
          <DropdownMenuRadioGroup value={selected} onValueChange={select}>
            <DropdownMenuRadioItem
              value="users"
              icon={IcOutlineSettings}
              textValue="Manage users"
              className={styles.WorkspaceMenu.option()}
            >
              Manage users
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface WorkspaceAvatarMenuProps {
  page: Page
}

export function WorkspaceAvatarMenu({page}: WorkspaceAvatarMenuProps) {
  const workspace = useAtomValueRaw(workspaceAtom(page.workspace!))
  const workspaces = useAtomValueRaw(workspacesAtom)
  const setRoute = useSetAtom(routeAtom)
  const avatar = (
    <WorkspaceAvatar
      color={workspace.color}
      icon={workspace.icon}
      label={workspace.label}
    />
  )
  if (workspaces.length <= 1) {
    return (
      <div
        className={styles.WorkspaceMenu.avatarTrigger()}
        role="img"
        aria-label={workspace.label}
      >
        {avatar}
      </div>
    )
  }
  function showWorkspaces() {
    setRoute({page: 'splash'})
  }
  return (
    <Button
      size="icon-lg"
      variant="ghost"
      className={styles.WorkspaceMenu.avatarTrigger()}
      aria-label="Back to workspaces"
      onClick={showWorkspaces}
    >
      {avatar}
    </Button>
  )
}

interface SearchPopupProps {
  initialSearchScope?: 'everything' | 'workspace'
  root: RootAtoms
}

interface GlobalSearchProps {
  children: ReactNode
  initialSearchScope?: 'everything' | 'workspace'
  root: RootAtoms
}

function SearchPopup({initialSearchScope, root}: SearchPopupProps) {
  const modal = useDialog()
  const setRoute = useSetAtom(routeAtom)
  const [explorer] = useState(() =>
    createExplorerAtoms(
      {workspace: root.workspace, root: root.key},
      {
        allowAllWorkspaces: true,
        autoSelectFirstItem: true,
        breadcrumbs: true,
        enableNavigation: true,
        initialSearchScope,
        mode: 'search',
        rootData: root.data,
        searchDepth: 'all',
        onAction(entry) {
          setRoute({
            workspace: entry.workspace,
            root: entry.root,
            entry: entry.id,
            locale: entry.locale ?? undefined
          })
          modal.close()
        }
      }
    )
  )
  const explorerPage = useAtomValueRawSync(explorer.page)
  if (!explorerPage)
    return <DashboardModalDialog variant="explorer" isLoading />
  return (
    <DashboardModalDialog variant="explorer">
      <ExplorerModalSuspense>
        <ExplorerModal>
          <ExplorerHeader
            autoFocusSearch
            controls={<DashboardModalCloseButton />}
            explorer={explorer}
            onSearchEscape={modal.close}
            page={explorerPage}
          />
          <ExplorerBody explorer={explorer} page={explorerPage} />
        </ExplorerModal>
      </ExplorerModalSuspense>
    </DashboardModalDialog>
  )
}

/** Opens the entry search from its trigger or with ⌘K / Ctrl+K */
export function GlobalSearch({
  children,
  initialSearchScope,
  root
}: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  useSearchShortcut(() => {
    if (open) return setOpen(false)
    // Leave other modals, eg. a link picker, in charge of the keyboard
    if (document.querySelector('[data-slot="dialog-content"]')) return
    setOpen(true)
  })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DashboardModal size="explorer" aria-label="Search entries">
        <Suspense
          fallback={<DashboardModalDialog variant="explorer" isLoading />}
        >
          <SearchPopup initialSearchScope={initialSearchScope} root={root} />
        </Suspense>
      </DashboardModal>
    </Dialog>
  )
}

export function WorkspaceMenu({
  canManageMembers,
  page,
  root,
  workspace
}: WorkspaceMenuProps) {
  const workspaces = useAtomValueRaw(workspacesAtom)
  const menu =
    workspaces.length > 1 ? (
      <WorkspaceSelectorMenu
        page={page}
        ariaLabel="Workspace"
        includeUsersLink={canManageMembers}
        label={
          <Button variant="ghost" className={styles.WorkspaceMenu.trigger()}>
            <span className={styles.WorkspaceMenu.trigger.text()}>
              {workspace.label}
            </span>
            <Icon icon={IcRoundUnfoldMore} fontSize={12} />
          </Button>
        }
      />
    ) : (
      <div className={styles.WorkspaceMenu.trigger()}>
        <span className={styles.WorkspaceMenu.trigger.text()}>
          {workspace.label}
        </span>
      </div>
    )
  return (
    <div className={styles.WorkspaceMenu.parent()}>
      {menu}
      <GlobalSearch root={root}>
        <Button
          size="icon-sm"
          variant="ghost"
          icon={IcRoundSearch}
          className={styles.WorkspaceMenu.search()}
          aria-label="Search entries"
          aria-keyshortcuts={searchShortcutKeys}
        />
      </GlobalSearch>
    </div>
  )
}

interface WorkspaceItemProps {
  workspace: string
}

function WorkspaceItem({workspace}: WorkspaceItemProps) {
  const data = useAtomValueRaw(workspaceAtom(workspace))
  return (
    <DropdownMenuRadioItem
      value={workspace}
      textValue={data.label}
      className={styles.WorkspaceMenu.option()}
    >
      <WorkspaceAvatar
        color={data.color}
        icon={data.icon}
        label={data.label}
        size="sm"
      />
      {data.label}
    </DropdownMenuRadioItem>
  )
}
