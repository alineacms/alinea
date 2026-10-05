import {
  Alert,
  Badge,
  AlertDescription,
  AppShell,
  AppShellContent,
  Button,
  Dialog,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  MultipleSelect,
  NavRail,
  NavRailContent,
  NavRailFooter,
  NavRailItem,
  Page as PageLayout,
  PageHeader,
  PageTitle,
  MultipleSelectItem,
  SearchField,
  Table,
  TableCell,
  TableRow,
  type TableColumn,
  Text,
  TextField,
  useDialog
} from '#/components.js'
import type {User, UserInput} from '#/core/User.js'
import styler from '@alinea/styler'
import {atom, useAtomValueRaw, useSetAtom} from 'jotai'
import {useId, useMemo, useState, type FormEvent} from 'react'
import {clientAtom, configAtom} from '../../atoms/core.js'
import {Page, page, routeAtom} from '../../atoms/nav.js'
import {
  IcBaselineErrorOutline,
  IcRoundAdd,
  IcRoundArrowBack,
  IcRoundMoreHoriz,
  IcRoundSearch
} from '../../icons.js'
import {ActivityStatus} from '../ActivityStatus.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from '../ui/DashboardModal.js'
import css from './UsersPage.module.css'

const styles = styler(css)

interface RoleItem {
  id: string
  name: string
}

const userColumns: Array<TableColumn> = [
  {id: 'user', header: 'User', minWidth: 200},
  {id: 'roles', header: 'Roles', minWidth: 160},
  {id: 'actions', header: null, width: 52, align: 'end'}
]

type UsersAction =
  | {type: 'create'; user: UserInput}
  | {type: 'update'; user: UserInput}
  | {type: 'remove'; email: string}

/** Whether the users page is open, so the users load once per visit */
const usersPageOpenAtom = atom(get => get(routeAtom).page === 'users')

/**
 * The users of the current visit to the page, loaded when it opens and
 * updated by the edits made on it
 */
const visitUsersAtom = atom(get => {
  if (!get(usersPageOpenAtom)) return undefined
  return atom(get(clientAtom).listUsers())
})

/** @internal */
export const usersAtom = atom(
  async get => {
    const users = get(visitUsersAtom)
    return users ? get(users) : []
  },
  async (get, set, action: UsersAction): Promise<void> => {
    const client = get(clientAtom)
    let update: (users: Array<User>) => Array<User>
    if (action.type === 'remove') {
      await client.removeUser(action.email)
      update = users => removeUser(users, action.email)
    } else {
      const saved =
        action.type === 'create'
          ? await client.createUser(action.user)
          : await client.updateUser(action.user)
      update = users => upsertUser(users, saved)
    }
    // The users may have loaded again while the edit was saved
    const users = get(visitUsersAtom)
    if (users) set(users, async current => update(await current))
  }
)

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

export const usersPage = page(async (page, get) => {
  let users: Array<User> = []
  let error: string | undefined
  try {
    users = await get(usersAtom)
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause)
  }
  return (
    <AppShell>
      <UsersPageSidebar page={page} />
      <AppShellContent>
        <UsersPage users={users} error={error} />
      </AppShellContent>
    </AppShell>
  )
})

export interface UsersPageProps {
  users: Array<User>
  /** Why the users could not be loaded */
  error?: string
}

export function UsersPage({users, error}: UsersPageProps) {
  const config = useAtomValueRaw(configAtom)
  const [query, setQuery] = useState('')
  const [editingUser, setEditingUser] = useState<User>()
  const [deletingUser, setDeletingUser] = useState<User>()

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
    <PageLayout className={styles.UsersPage()}>
      <PageHeader className={styles.UsersPage.header()}>
        <PageTitle>Manage users</PageTitle>

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
      </PageHeader>
      <div className={styles.UsersPage.content()}>
        {error !== undefined ? (
          <UsersPageStatus label={error || 'Failed to load users'} />
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
    </PageLayout>
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
    <NavRail aria-label="Users">
      <NavRailContent>
        <NavRailItem
          icon={IcRoundArrowBack}
          label="Back to app"
          onClick={handleBack}
        />
      </NavRailContent>
      <NavRailFooter>
        <ActivityStatus mobileSide="bottom" mobileAlign="end" />
      </NavRailFooter>
    </NavRail>
  )
}

interface UsersPageStatusProps {
  label: string
}

function UsersPageStatus({label}: UsersPageStatusProps) {
  return (
    <div className={styles.UsersPage.status()}>
      <Text as="p">{label}</Text>
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
    <Table
      aria-label="Users"
      items={users}
      columns={userColumns}
      rowHeight={40}
      className={styles.UsersPage.table()}
      dependencies={[roleLabel, onEdit, onDeactivate]}
      renderEmptyState={() => <Text color="muted">No users found</Text>}
    >
      {user => (
        <TableRow
          id={user.email ?? user.sub}
          textValue={[user.name, user.email || user.sub]
            .filter(Boolean)
            .join(' ')}
        >
          <TableCell>
            <UserIdentity user={user} />
          </TableCell>
          <TableCell>
            <UserRoles user={user} roleLabel={roleLabel} />
          </TableCell>
          <TableCell align="end">
            <UserActionsMenu
              user={user}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
            />
          </TableCell>
        </TableRow>
      )}
    </Table>
  )
}

interface UserIdentityProps {
  user: User
}

function UserIdentity({user}: UserIdentityProps) {
  return (
    <span className={styles.UsersPage.identity()}>
      {user.name && (
        <span className={styles.UsersPage.identity.person()}>{user.name}</span>
      )}
      <span className={styles.UsersPage.identity.email()}>
        {user.email || user.sub}
      </span>
    </span>
  )
}

interface UserRolesProps {
  user: User
  roleLabel: (role: string) => string | undefined
}

function UserRoles({user, roleLabel}: UserRolesProps) {
  const roles = (user.roles ?? [])
    .map(role => {
      const label = roleLabel(role)
      return label ? {id: role, label} : undefined
    })
    .filter((role): role is {id: string; label: string} => Boolean(role))
  if (roles.length === 0) return <Text color="muted">No roles</Text>
  return (
    <span className={styles.UsersPage.roles()}>
      {roles.map(role => (
        <Badge key={role.id} size="sm">
          {role.label}
        </Badge>
      ))}
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
      <DropdownMenuContent aria-label={`Actions for ${label}`} align="end">
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
          <Text as="p">
            Are you sure you want to deactivate {label}? This will remove the
            user account and role assignments.
          </Text>
          {error && (
            <Alert variant="destructive" icon={IcBaselineErrorOutline}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </DashboardModalContent>
      <DashboardModalFooter>
        <Button
          type="button"
          variant="outline"
          color="neutral"
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
  const formId = useId()
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
      <form onSubmit={handleSubmit} id={formId}>
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
              <Alert variant="destructive" icon={IcBaselineErrorOutline}>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </DashboardModalContent>
      </form>
      <DashboardModalFooter>
        <Button
          type="button"
          variant="outline"
          color="neutral"
          onClick={modal.close}
        >
          Cancel
        </Button>
        <Button type="submit" color="primary" loading={isPending} form={formId}>
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
