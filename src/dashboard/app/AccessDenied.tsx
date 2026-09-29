import {
  AppShell,
  AppShellContent,
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon
} from '#/components.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {styler} from '@alinea/styler'
import {useSetAtom} from 'jotai'
import {IcRoundLock} from '../icons.js'
import css from './AccessDenied.module.css'

const styles = styler(css)

const copy = {
  root: {
    title: 'No root access',
    message: 'Your current roles do not grant permission to read any root.'
  },
  users: {
    title: 'No user management access',
    message: 'Your current roles do not grant permission to manage users.'
  },
  workspace: {
    title: 'No workspace access',
    message: 'Your current roles do not grant permission to read any workspace.'
  }
}

export interface AccessDeniedProps {
  canManageMembers: boolean
  scope: keyof typeof copy
}

export function AccessDenied({canManageMembers, scope}: AccessDeniedProps) {
  const setRoute = useSetAtom(routeAtom)
  const {title, message} = copy[scope]
  return (
    <AppShell>
      <AppShellContent>
        <div className={styles.AccessDenied()}>
          <Empty variant="card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon icon={IcRoundLock} />
              </EmptyMedia>
              <EmptyTitle as="h1">{title}</EmptyTitle>
              <EmptyDescription>{message}</EmptyDescription>
            </EmptyHeader>
            {canManageMembers && (
              <EmptyContent>
                <Button
                  variant="ghost"
                  color="primary"
                  onClick={() => setRoute({page: 'users'})}
                >
                  Manage users
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </div>
      </AppShellContent>
    </AppShell>
  )
}
