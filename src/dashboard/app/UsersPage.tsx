import {
  Button,
  Cell,
  Column,
  DialogTrigger,
  Icon,
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
import {useAtomValue, useSetAtom} from 'jotai'
import {type FormEvent, useEffect, useMemo, useState} from 'react'
import {useListData} from 'react-stately'
import {
  IcRoundAdd,
  IcRoundArrowBack,
  IcRoundEdit
} from '../icons.js'
import type {Dashboard} from '../store/Dashboard.js'
import {Badge} from './Badge.js'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter,
  useDashboardModal
} from './ui/DashboardModal.js'
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
  id: 'user' | 'roles' | 'actions'
  name: string
  isRowHeader?: boolean
}

const userColumns: Array<UserColumn> = [
  {id: 'user', name: 'User', isRowHeader: true},
  {id: 'roles', name: 'Roles'},
  {id: 'actions', name: ''}
]

export function UsersPage({dashboard}: UsersPageProps) {
  const client = useAtomValue(dashboard.client)
  const config = useAtomValue(dashboard.config)
  const [users, setUsers] = useState<Array<User>>([])
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let cancelled = false
    async function loadUsers() {
      setIsLoading(true)
      setError(undefined)
      try {
        const loaded = await client.listUsers()
        if (!cancelled) setUsers(loaded)
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [client])

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const filtered = normalized
      ? users.filter(user => {
          return userSearchText(user, config.roles).includes(normalized)
        })
      : users
    return filtered.toSorted(compareUsers)
  }, [config.roles, query, users])

  function handleSaved(user: User) {
    setUsers(current => {
      const existing = current.findIndex(
        item => item.email?.toLowerCase() === user.email?.toLowerCase()
      )
      if (existing === -1) return [...current, user]
      const next = current.slice()
      next[existing] = user
      return next
    })
  }

  return (
    <div className={styles.UsersPage()}>
      <header className={styles.UsersPage.header()}>
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
            <UserModal dashboard={dashboard} onSaved={handleSaved} />
          </DashboardModal>
        </DialogTrigger>
      </header>
      <div className={styles.UsersPage.content()}>
        {isLoading ? (
          <UsersPageStatus label="Loading users" pending />
        ) : error ? (
          <UsersPageStatus label={error} />
        ) : (
          <UsersTable
            users={filteredUsers}
            roleLabel={role => config.roles?.[role]?.label}
            dashboard={dashboard}
            onSaved={handleSaved}
          />
        )}
      </div>
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
  dashboard: Dashboard
  onSaved: (user: User) => void
  users: Array<User>
  roleLabel: (role: string) => string | undefined
}

function UsersTable({dashboard, onSaved, users, roleLabel}: UsersTableProps) {
  return (
    <Table aria-label="Users" className={styles.UsersPage.table()}>
      <TableHeader columns={userColumns}>
        {column => (
          <Column
            id={column.id}
            isRowHeader={column.isRowHeader}
            className={
              column.id === 'actions'
                ? styles.UsersPage.actionColumn()
                : undefined
            }
          >
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
              <Cell
                className={
                  column.id === 'actions'
                    ? styles.UsersPage.actionCell()
                    : undefined
                }
              >
                {renderUserCell(user, column.id, roleLabel, dashboard, onSaved)}
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
  dashboard: Dashboard,
  onSaved: (user: User) => void
) {
  if (column === 'user') {
    return (
      <span className={styles.UsersPage.identity()}>
        {user.name && (
          <span className={styles.UsersPage.identity.title()}>{user.name}</span>
        )}
        <span className={styles.UsersPage.identity.email()}>
          {user.email || user.sub}
        </span>
      </span>
    )
  }
  if (column === 'actions') {
    return (
      <span className={styles.UsersPage.actions()}>
        <DialogTrigger>
          <Button
            size="icon-small"
            appearance="plain"
            icon={IcRoundEdit}
            aria-label={`Edit ${user.name || user.email || user.sub}`}
          />
          <DashboardModal>
            <UserModal dashboard={dashboard} user={user} onSaved={onSaved} />
          </DashboardModal>
        </DialogTrigger>
      </span>
    )
  }
  const roles = (user.roles ?? [])
    .map(role => {
      const label = roleLabel(role)
      return label ? {id: role, label} : undefined
    })
    .filter((role): role is {id: string; label: string} => Boolean(role))
  if (roles.length === 0) {
    return <span className={styles.UsersPage.noRoles()}>No roles</span>
  }
  return (
    <span className={styles.UsersPage.roles()}>
      {roles.map(role => (
        <Badge key={role.id} size="small">
          {role.label}
        </Badge>
      ))}
    </span>
  )
}

interface UserModalProps {
  dashboard: Dashboard
  onSaved: (user: User) => void
  user?: User
}

function UserModal({dashboard, onSaved, user}: UserModalProps) {
  const client = useAtomValue(dashboard.client)
  const config = useAtomValue(dashboard.config)
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
      const saved = isEditing
        ? await client.updateUser(request)
        : await client.createUser(request)
      onSaved(saved)
      modal.close()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <DashboardModalDialog label={isEditing ? 'Edit user' : 'Create user'}>
      <form className={styles.UsersPage.form()} onSubmit={handleSubmit}>
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
              placeholder="Optional"
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
        <DashboardModalFooter>
          <Button
            type="button"
            appearance="outline"
            intent="secondary"
            onPress={modal.close}
          >
            Cancel
          </Button>
          <Button type="submit" intent="primary" isPending={isPending}>
            {isEditing ? 'Save changes' : 'Create user'}
          </Button>
        </DashboardModalFooter>
      </form>
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
