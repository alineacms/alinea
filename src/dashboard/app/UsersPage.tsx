import {
  Button,
  Cell,
  Column,
  DialogTrigger,
  Icon,
  Menu,
  MenuItem,
  MultipleSelect,
  MultipleSelectItem,
  ProgressCircle,
  Row,
  SearchField,
  Table,
  TableBody,
  TableHeader,
  Tag,
  TextField
} from '#/components.js'
import type {User, UserInput} from '#/core/User.js'
import styler from '@alinea/styler'
import {atom, useAtom, useAtomValue, useSetAtom} from 'jotai'
import {useMemo, useState, type FormEvent, type Key} from 'react'
import {useListData} from 'react-stately'
import {IcRoundAdd, IcRoundArrowBack, IcRoundMoreHoriz} from '../icons.js'
import {dashboardAtom, type Dashboard} from '../store/Dashboard.js'
import {Badge} from './Badge.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter,
  useDashboardModal
} from './ui/DashboardModal.js'
import {SidebarHeader} from './ui/Sidebar.js'
import css from './UsersPage.module.css'

const styles = styler(css)

interface UsersPageProps {
  dashboard: Dashboard
}

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
    const dashboard = get(dashboardAtom)
    const client = get(dashboard.client)
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

export function UsersPage({dashboard}: UsersPageProps) {
  const config = useAtomValue(dashboard.config)
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
      <SidebarHeader>
        <div className={styles.UsersPage.header.title()}>Manage users</div>

        <SearchField
          aria-label="Search users"
          placeholder="Search users"
          hasIcon
          value={query}
          onChange={setQuery}
          className={styles.UsersPage.search()}
        />
        <DialogTrigger>
          <Button
            intent="primary"
            icon={IcRoundAdd}
            className={styles.UsersPage.createButton()}
          >
            Create user
          </Button>
          <DashboardModal>
            <UserModal dashboard={dashboard} />
          </DashboardModal>
        </DialogTrigger>
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
        isOpen={editingUser !== undefined}
        onOpenChange={isOpen => {
          if (!isOpen) setEditingUser(undefined)
        }}
      >
        {editingUser && <UserModal dashboard={dashboard} user={editingUser} />}
      </DashboardModal>
      <DashboardModal
        isOpen={deletingUser !== undefined}
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
  dashboard: Dashboard
}

export function UsersPageSidebar({dashboard}: UsersPageSidebarProps) {
  const setRoute = useSetAtom(dashboard.route)
  const selectedWorkspace = useAtomValue(dashboard.selectedWorkspace)
  const selectedRoot = useAtomValue(dashboard.selectedRoot)

  function handleBack() {
    void setRoute({
      page: 'entry',
      workspace: selectedWorkspace ?? undefined,
      root: selectedRoot ?? undefined
    })
  }

  return (
    <aside className={styles.UsersPageSidebar()} aria-label="Users">
      <nav className={styles.UsersPageSidebar.nav()}>
        <Button
          aria-label="Back to app"
          appearance="plain"
          className={styles.UsersPageSidebar.item()}
          size="icon-nav"
          onPress={handleBack}
        >
          <Icon
            icon={IcRoundArrowBack}
            className={styles.UsersPageSidebar.icon()}
          />
        </Button>
      </nav>
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
      {pending && <ProgressCircle isIndeterminate aria-label={label} />}
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
      <TableHeader columns={userColumns}>
        {column => (
          <Column id={column.id} isRowHeader={column.isRowHeader}>
            {column.name}
          </Column>
        )}
      </TableHeader>
      <TableBody
        items={users}
        renderEmptyState={() => (
          <span className={styles.UsersPage.empty()}>No users found</span>
        )}
      >
        {user => (
          <Row id={user.email ?? user.sub} columns={userColumns}>
            {column => (
              <Cell>
                {renderUserCell(
                  user,
                  column.id,
                  roleLabel,
                  onEdit,
                  onDeactivate
                )}
              </Cell>
            )}
          </Row>
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
            <Badge key={role.id} size="small">
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

  function handleAction(key: Key) {
    if (key === 'edit') {
      onEdit(user)
      return
    }
    if (key !== 'deactivate' || !email) return
    onDeactivate(user)
  }

  return (
    <Menu
      aria-label={`Actions for ${label}`}
      label={
        <Button
          aria-label={`Actions for ${label}`}
          appearance="plain"
          size="icon-small"
          icon={IcRoundMoreHoriz}
        />
      }
      disabledKeys={email ? undefined : ['deactivate']}
      onAction={handleAction}
    >
      <MenuItem id="edit">Edit</MenuItem>
      <MenuItem id="deactivate">Deactivate account</MenuItem>
    </Menu>
  )
}

interface DeactivateUserModalProps {
  user: User
}

function DeactivateUserModal({user}: DeactivateUserModalProps) {
  const saveUser = useSetAtom(usersAtom)
  const modal = useDashboardModal()
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
          appearance="outline"
          intent="secondary"
          onPress={modal.close}
        >
          Cancel
        </Button>
        <Button
          type="button"
          intent="danger"
          isDisabled={!email}
          isPending={isPending}
          onPress={handleDeactivate}
        >
          Deactivate account
        </Button>
      </DashboardModalFooter>
    </DashboardModalDialog>
  )
}

interface UserModalProps {
  dashboard: Dashboard
  user?: User
}

function UserModal({dashboard, user}: UserModalProps) {
  const config = useAtomValue(dashboard.config)
  const saveUser = useSetAtom(usersAtom)
  const modal = useDashboardModal()
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
  const selectedRoles = useListData<RoleItem>({
    initialItems: (user?.roles ?? [])
      .map(role => roleItems.find(item => item.id === role))
      .filter((item): item is RoleItem => Boolean(item))
  })

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
        roles: selectedRoles.items.map(item => String(item.id))
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
              onChange={setEmail}
              isRequired
              isDisabled={isEditing}
              autoFocus={!isEditing}
              inputProps={{
                autoComplete: 'off',
                'data-1p-ignore': 'true'
              }}
            />
            <TextField
              label="Name"
              value={name}
              onChange={setName}
              autoFocus={isEditing}
              inputProps={{
                autoComplete: 'off',
                'data-1p-ignore': 'true'
              }}
            />
            <MultipleSelect
              label="Roles"
              placeholder="Select roles"
              items={roleItems}
              selectedItems={selectedRoles}
              tag={item => <Tag data-shape="circle">{item.name}</Tag>}
              renderEmptyState={() => 'No roles'}
            >
              {item => (
                <MultipleSelectItem id={item.id} textValue={item.name}>
                  {item.name}
                </MultipleSelectItem>
              )}
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
          appearance="outline"
          intent="secondary"
          onPress={modal.close}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          intent="primary"
          isPending={isPending}
          form="submit"
        >
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
