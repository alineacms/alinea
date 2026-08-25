import styler from '@alinea/styler'
import {
  IcRoundAdd,
  IcRoundArrowBack,
  IcRoundEdit,
  IcRoundMoreVert
} from '#/dashboard/icons.js'
import {
  AppShell,
  AppShellContent,
  AppShellInner,
  AppShellSidebar
} from './AppShell.js'
import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {
  DataTable,
  DataTableCell,
  DataTableCellMeta,
  DataTableCellStack,
  DataTableCellTitle,
  DataTableHeader,
  DataTableRow
} from './DataTable.js'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderMain,
  PageHeaderSearch,
  PageHeaderTitle,
  PageHeaderTools
} from './PageHeader.js'
import {SearchField} from './SearchField.js'
import css from './UsersPage.module.css'

const styles = styler(css)

const users = [
  {
    initials: 'AR',
    name: 'Ada Richards',
    email: 'ada@alinea.example',
    roles: ['Owner', 'Editor'],
    status: 'Active'
  },
  {
    initials: 'JM',
    name: 'Jonas Miller',
    email: 'jonas@alinea.example',
    roles: ['Editor'],
    status: 'Active'
  },
  {
    initials: 'SK',
    name: 'Sofia Kim',
    email: 'sofia@alinea.example',
    roles: ['Translator'],
    status: 'Invited'
  },
  {
    initials: 'MT',
    name: 'Milo Turner',
    email: 'milo@alinea.example',
    roles: ['Developer', 'Editor'],
    status: 'Active'
  },
  {
    initials: 'LN',
    name: 'Lea Nguyen',
    email: 'lea@alinea.example',
    roles: [],
    status: 'Inactive'
  }
]

export function UsersPage() {
  return (
    <AppShell>
      <AppShellInner>
        <AppShellSidebar label="Users">
          <Button appearance="plain" aria-label="Back to app" size="icon-nav">
            <IcRoundArrowBack />
          </Button>
        </AppShellSidebar>
        <AppShellContent>
          <div className={styles['alinea-UsersPage']()}>
            <PageHeader>
              <PageHeaderMain>
                <PageHeaderTitle>Manage users</PageHeaderTitle>
              </PageHeaderMain>
              <PageHeaderTools>
                <PageHeaderSearch>
                  <SearchField
                    aria-label="Search users"
                    placeholder="Search users"
                  />
                </PageHeaderSearch>
                <PageHeaderActions>
                  <Button intent="primary" icon={<IcRoundAdd />}>
                    Create user
                  </Button>
                </PageHeaderActions>
              </PageHeaderTools>
            </PageHeader>
            <div className={styles['alinea-UsersPage-content']()}>
              <DataTable
                columns="minmax(260px, 2fr) minmax(220px, 1fr) 120px 44px"
                label="Users"
              >
                <DataTableHeader>
                  <DataTableCell header>User</DataTableCell>
                  <DataTableCell header>Roles</DataTableCell>
                  <DataTableCell header>Status</DataTableCell>
                  <DataTableCell header />
                </DataTableHeader>
                {users.map(user => (
                  <DataTableRow key={user.email} tabIndex={0}>
                    <DataTableCell>
                      <div className={styles['alinea-UsersPage-identity']()}>
                        <span className={styles['alinea-UsersPage-avatar']()}>
                          {user.initials}
                        </span>
                        <DataTableCellStack>
                          <DataTableCellTitle>{user.name}</DataTableCellTitle>
                          <DataTableCellMeta>{user.email}</DataTableCellMeta>
                        </DataTableCellStack>
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div className={styles['alinea-UsersPage-roles']()}>
                        {user.roles.length > 0 ? (
                          user.roles.map(role => (
                            <Badge key={role} size="small">
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <DataTableCellMeta>No roles</DataTableCellMeta>
                        )}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge
                        size="small"
                        status={
                          user.status === 'Active' ? 'published' : 'archived'
                        }
                      >
                        {user.status}
                      </Badge>
                    </DataTableCell>
                    <DataTableCell align="center">
                      <Button
                        appearance="plain"
                        aria-label={`Edit ${user.name}`}
                        size="icon-small"
                      >
                        {user.status === 'Active' ? (
                          <IcRoundEdit />
                        ) : (
                          <IcRoundMoreVert />
                        )}
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTable>
            </div>
          </div>
        </AppShellContent>
      </AppShellInner>
    </AppShell>
  )
}
