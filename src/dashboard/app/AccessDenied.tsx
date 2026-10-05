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
  /** Offers a way back to the content of this workspace and root */
  back?: {workspace: string; root: string}
}

export function AccessDenied({
  canManageMembers,
  scope,
  back
}: AccessDeniedProps) {
  const setRoute = useSetAtom(routeAtom)
  const {title, message} = copy[scope]
  return (
    <div className={styles.AccessDenied()}>
      <Empty variant="card" className={styles.AccessDenied.card()}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon icon={IcRoundLock} />
          </EmptyMedia>
          <EmptyTitle as="h1">{title}</EmptyTitle>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
        {(back || canManageMembers) && (
          <EmptyContent>
            {back && (
              <Button
                variant="outline"
                color="neutral"
                onClick={() => setRoute({page: 'entry', ...back})}
              >
                Back to content
              </Button>
            )}
            {canManageMembers && (
              <Button
                variant="ghost"
                color="primary"
                onClick={() => setRoute({page: 'users'})}
              >
                Manage users
              </Button>
            )}
          </EmptyContent>
        )}
      </Empty>
    </div>
  )
}

export function AccessDeniedPage(props: AccessDeniedProps) {
  return (
    <AppShell>
      <AppShellContent>
        <AccessDenied {...props} />
      </AppShellContent>
    </AppShell>
  )
}
