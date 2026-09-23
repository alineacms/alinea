import {
  Button,
  Dialog,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
  MultipleSelect,
  MultipleSelectItem,
  Spinner,
  SearchField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextField,
  useDialog
} from '#/components.js'
import type {User, UserInput} from '#/core/User.js'
import styler from '@alinea/styler'
import {atom, useAtom, useAtomValueRaw, useSetAtom} from 'jotai'
import {useMemo, useState, type FormEvent} from 'react'
import {clientAtom, configAtom} from '../../atoms/core.js'
import {Page, page, routeAtom} from '../../atoms/nav.js'
import {
  IcRoundAdd,
  IcRoundArrowBack,
  IcRoundMoreHoriz,
  IcRoundSearch
} from '../../icons.js'
import {ActivityStatus} from '../ActivityStatus.js'
import {AppShell, AppShellContent, AppShellInner} from '../AppShell.js'
import {Badge} from '#/components.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from '../ui/DashboardModal.js'
import {SidebarHeader} from '../ui/Sidebar.js'
import css from './UsersPage.module.css'

const styles = styler(css)

interface RoleItem {
  id: string
  name: string
}

interface UserColumn {
  id: 'user' | 'roles'
  name: string
  isRowHeader?: boolean
}

const userColumns: Array<UserColumn> = [
  {id: 'user', name: 'User', isRowHeader: true},
  {id: 'roles', name: 'Roles'}
]

interface UsersState {
  error?: string
  status: 'loading' | 'loaded' | 'error'
  users: Array<User>
}

type UsersAction =
  | {type: 'load'}
  | {type: 'create'; user: UserInput}
  | {type: 'update'; user: UserInput}
  | {type: 'remove'; email: string}

const usersStateAtom = atom<UsersState>({
  status: 'loading',
  users: []
})

const usersAtom = atom(
  get => get(usersStateAtom),
  async (get, set, action: UsersAction): Promise<User | undefined> => {
    const client = get(clientAtom)
    if (action.type === 'load') {
      const current = get(usersStateAtom)
      set(usersStateAtom, {...current, error: undefined, status: 'loading'})
      try {
        const users = await client.listUsers()
        set(usersStateAtom, {status: 'loaded', users})
      } catch (cause) {
        set(usersStateAtom, {
          error: cause instanceof Error ? cause.message : String(cause),
          status: 'error',
          users: current.users
        })
      }
      return undefined
    }
    if (action.type === 'remove') {
      await client.removeUser(action.email)
      set(usersStateAtom, current => {
        return {
          status: 'loaded',
          users: removeUser(current.users, action.email)
        }
      })
      return undefined
    }
    const saved =
      action.type === 'create'
        ? await client.createUser(action.user)
        : await client.updateUser(action.user)
    set(usersStateAtom, current => {
      return {
        status: 'loaded',
        users: upsertUser(current.users, saved)
      }
    })
    return saved
  }
)

usersAtom.onMount = dispatch => {
  void dispatch({type: 'load'})
}

function upsertUser(users: Array<User>, user: User): Array<User> {
  const existing = users.findIndex(
    item => item.email?.toLowerCase() === user.email?.toLowerCase()
  )
  if (existing === -1) return [...users, user]
  const next = users.slice()
  next[existing] = user
  return next
}

function removeUser(users: Array<User>, email: string): Array<User> {
  const normalized = email.toLowerCase()
  return users.filter(user => user.email?.toLowerCase() !== normalized)
}

export const usersPage = page(page => {
  return (
    <AppShell>
      <AppShellInner>
        <UsersPageSidebar page={page} />
        <AppShellContent>
          <UsersPage />
        </AppShellContent>
      </AppShellInner>
    </AppShell>
  )
})

export function UsersPage() {
  const config = useAtomValueRaw(configAtom)
  const [usersState] = useAtom(usersAtom)
  const [query, setQuery] = useState('')
  const [editingUser, setEditingUser] = useState<User>()
  const [deletingUser, setDeletingUser] = useState<User>()
  const users = usersState.users

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = normalized
      ? users.filter(user => {
          return userSearchText(user, config.roles).includes(normalized)
        })
      : users
    return filtered.toSorted(compareUsers)
  }, [config.roles, query, users])

  return (
    <div className={styles.UsersPage()}>
      <SidebarHeader className={styles.UsersPage.header()}>
        <div className={styles.UsersPage.header.title()}>Manage users</div>

        <SearchField
          aria-label="Search users"
          placeholder="Search users"
          icon={IcRoundSearch}
          value={query}
          onValueChange={setQuery}
          className={styles.UsersPage.search()}
        />
        <Dialog>
          <DialogTrigger
            color="primary"
            icon={IcRoundAdd}
            className={styles.UsersPage.createButton()}
          >
            Create user
          </DialogTrigger>
          <DashboardModal>
            <UserModal />
          </DashboardModal>
        </Dialog>
      </SidebarHeader>
      <div className={styles.UsersPage.content()}>
        {usersState.status === 'loading' ? (
          <UsersPageStatus label="Loading users" pending />
        ) : usersState.status === 'error' ? (
          <UsersPageStatus label={usersState.error ?? 'Failed to load users'} />
        ) : (
          <UsersTable
            users={filteredUsers}
            roleLabel={role => config.roles?.[role]?.label}
            onEdit={setEditingUser}
            onDeactivate={setDeletingUser}
          />
        )}
      </div>
      <DashboardModal
        open={editingUser !== undefined}
        onOpenChange={isOpen => {
          if (!isOpen) setEditingUser(undefined)
        }}
      >
        {editingUser && <UserModal user={editingUser} />}
      </DashboardModal>
      <DashboardModal
        open={deletingUser !== undefined}
        onOpenChange={isOpen => {
          if (!isOpen) setDeletingUser(undefined)
        }}
      >
        {deletingUser && <DeactivateUserModal user={deletingUser} />}
      </DashboardModal>
    </div>
  )
}

export interface UsersPageSidebarProps {
  page: Page
}

export function UsersPageSidebar({page}: UsersPageSidebarProps) {
  const setRoute = useSetAtom(routeAtom)

  function handleBack() {
    setRoute({
      page: 'entry',
      workspace: page.workspace ?? undefined,
      root: page.root ?? undefined
    })
  }

  return (
    <aside className={styles.UsersPageSidebar()} aria-label="Users">
      <nav className={styles.UsersPageSidebar.nav()}>
        <Button
          aria-label="Back to app"
          variant="ghost"
          className={styles.UsersPageSidebar.item()}
          size="icon-lg"
          onClick={handleBack}
        >
          <Icon
            icon={IcRoundArrowBack}
            className={styles.UsersPageSidebar.icon()}
          />
        </Button>
      </nav>
      <div className={styles.UsersPageSidebar.footer()}>
        <ActivityStatus mobileSide="bottom" mobileAlign="end" />
      </div>
    </aside>
  )
}

interface UsersPageStatusProps {
  label: string
  pending?: boolean
}

function UsersPageStatus({label, pending}: UsersPageStatusProps) {
  return (
    <div className={styles.UsersPage.status()}>
      {pending && <Spinner aria-label={label} />}
      <p className={styles.UsersPage.status.text()}>{label}</p>
    </div>
  )
}

interface UsersTableProps {
  onEdit: (user: User) => void
  onDeactivate: (user: User) => void
  users: Array<User>
  roleLabel: (role: string) => string | undefined
}

function UsersTable({onDeactivate, onEdit, users, roleLabel}: UsersTableProps) {
  return (
    <Table aria-label="Users" className={styles.UsersPage.table()}>
      <TableHeader>
        {userColumns.map(column => (
          <TableHead
            key={column.id}
            id={column.id}
            rowHeader={column.isRowHeader}
          >
            {column.name}
          </TableHead>
        ))}
      </TableHeader>
      <TableBody
        items={users}
        renderEmptyState={() => (
          <span className={styles.UsersPage.empty()}>No users found</span>
        )}
      >
        {user => (
          <TableRow id={user.email ?? user.sub}>
            {userColumns.map(column => (
              <TableCell key={column.id}>
                {renderUserCell(
                  user,
                  column.id,
                  roleLabel,
                  onEdit,
                  onDeactivate
                )}
              </TableCell>
            ))}
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

function renderUserCell(
  user: User,
  column: UserColumn['id'],
  roleLabel: (role: string) => string | undefined,
  onEdit: (user: User) => void,
  onDeactivate: (user: User) => void
) {
  if (column === 'user') {
    return (
      <span className={styles.UsersPage.identity()}>
        <span className={styles.UsersPage.identity.text()}>
          {user.name && (
            <span className={styles.UsersPage.identity.title()}>
              {user.name}
            </span>
          )}
          <span className={styles.UsersPage.identity.email()}>
            {user.email || user.sub}
          </span>
        </span>
      </span>
    )
  }
  const roles = (user.roles ?? [])
    .map(role => {
      const label = roleLabel(role)
      return label ? {id: role, label} : undefined
    })
    .filter((role): role is {id: string; label: string} => Boolean(role))
  return (
    <span className={styles.UsersPage.rolesCell()}>
      {roles.length === 0 ? (
        <span className={styles.UsersPage.noRoles()}>No roles</span>
      ) : (
        <span className={styles.UsersPage.roles()}>
          {roles.map(role => (
            <Badge key={role.id} size="sm">
              {role.label}
            </Badge>
          ))}
        </span>
      )}
      <UserActionsMenu
        user={user}
        onEdit={onEdit}
        onDeactivate={onDeactivate}
      />
    </span>
  )
}

interface UserActionsMenuProps {
  user: User
  onEdit: (user: User) => void
  onDeactivate: (user: User) => void
}

function UserActionsMenu({user, onDeactivate, onEdit}: UserActionsMenuProps) {
  const email = user.email
  const label = user.name || user.email || user.sub

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        variant="ghost"
        size="icon-sm"
        icon={IcRoundMoreHoriz}
      />
      <DropdownMenuContent aria-label={`Actions for ${label}`}>
        <DropdownMenuItem onSelect={() => onEdit(user)}>Edit</DropdownMenuItem>
        <DropdownMenuItem disabled={!email} onSelect={() => onDeactivate(user)}>
          Deactivate account
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface DeactivateUserModalProps {
  user: User
}

function DeactivateUserModal({user}: DeactivateUserModalProps) {
  const saveUser = useSetAtom(usersAtom)
  const modal = useDialog()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string>()
  const email = user.email
  const label = user.name || user.email || user.sub

  async function handleDeactivate() {
    if (!email) return
    setIsPending(true)
    setError(undefined)
    try {
      await saveUser({type: 'remove', email})
      modal.close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <DashboardModalDialog label="Deactivate account">
      <DashboardModalContent>
        <div className={styles.UsersPage.form.fields()}>
          <p className={styles.UsersPage.confirmation()}>
            Are you sure you want to deactivate {label}? This will remove the
            user account and role assignments.
          </p>
          {error && (
            <p className={styles.UsersPage.form.error()} role="alert">
              {error}
            </p>
          )}
        </div>
      </DashboardModalContent>
      <DashboardModalFooter>
        <Button
          type="button"
          variant="outline"
          color="secondary"
          onClick={modal.close}
        >
          Cancel
        </Button>
        <Button
          type="button"
          color="destructive"
          disabled={!email}
          loading={isPending}
          onClick={handleDeactivate}
        >
          Deactivate account
        </Button>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}

interface UserModalProps {
  user?: User
}

function UserModal({user}: UserModalProps) {
  const config = useAtomValueRaw(configAtom)
  const saveUser = useSetAtom(usersAtom)
  const modal = useDialog()
  const isEditing = user !== undefined
  const [email, setEmail] = useState(user?.email ?? '')
  const [name, setName] = useState(user?.name ?? '')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string>()
  const roleItems = useMemo<Array<RoleItem>>(() => {
    return Object.entries(config.roles ?? {}).map(([id, role]) => {
      return {id, name: role.label ?? id}
    })
  }, [config.roles])
  const [selectedRoles, setSelectedRoles] = useState<Array<string>>(() =>
    (user?.roles ?? []).filter(role => roleItems.some(item => item.id === role))
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const userEmail = email.trim()
    const userName = name.trim()
    if (!userEmail) {
      setError('Email is required')
      return
    }
    setIsPending(true)
    setError(undefined)
    try {
      const request: UserInput = {
        email: userEmail,
        name: userName || undefined,
        roles: selectedRoles
      }
      await saveUser({
        type: isEditing ? 'update' : 'create',
        user: request
      })
      modal.close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <DashboardModalDialog label={isEditing ? 'Edit user' : 'Create user'}>
      <form onSubmit={handleSubmit} id="submit">
        <DashboardModalContent>
          <div className={styles.UsersPage.form.fields()}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onValueChange={setEmail}
              required
              disabled={isEditing}
              autoFocus={!isEditing}
              autoComplete="off"
              inputProps={{'data-1p-ignore': 'true'}}
            />
            <TextField
              label="Name"
              value={name}
              onValueChange={setName}
              autoFocus={isEditing}
              autoComplete="off"
              inputProps={{'data-1p-ignore': 'true'}}
            />
            <MultipleSelect
              label="Roles"
              placeholder="Select roles"
              value={selectedRoles}
              onValueChange={setSelectedRoles}
              emptyMessage="No roles"
            >
              {roleItems.map(item => (
                <MultipleSelectItem key={item.id} value={item.id}>
                  {item.name}
                </MultipleSelectItem>
              ))}
            </MultipleSelect>
            {error && (
              <p className={styles.UsersPage.form.error()} role="alert">
                {error}
              </p>
            )}
          </div>
        </DashboardModalContent>
      </form>
      <DashboardModalFooter>
        <Button
          type="button"
          variant="outline"
          color="secondary"
          onClick={modal.close}
        >
          Cancel
        </Button>
        <Button type="submit" color="primary" loading={isPending} form="submit">
          {isEditing ? 'Save changes' : 'Create user'}
        </Button>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}

function userSearchText(
  user: User,
  roles: Record<string, {label: string}> | undefined
) {
  return [
    user.name,
    user.email,
    user.sub,
    ...(user.roles ?? []).map(role => roles?.[role]?.label)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function compareUsers(a: User, b: User): number {
  const name = (a.name ?? '').localeCompare(b.name ?? '', undefined, {
    sensitivity: 'base'
  })
  if (name !== 0) return name
  return (a.email ?? a.sub).localeCompare(b.email ?? b.sub, undefined, {
    sensitivity: 'base'
  })
}
