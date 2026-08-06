import {Button, Surface} from '#/components.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {styler} from '@alinea/styler'
import {useSetAtom} from 'jotai'
import {AppShell, AppShellContent, AppShellInner} from './AppShell.js'
import css from './AccessDenied.module.css'

const styles = styler(css)

export interface AccessDeniedProps {
  canManageMembers: boolean
  scope: 'root' | 'workspace'
}

export function AccessDenied({canManageMembers, scope}: AccessDeniedProps) {
  const setRoute = useSetAtom(routeAtom)
  const title = scope === 'workspace' ? 'No workspace access' : 'No root access'
  const target = scope === 'workspace' ? 'workspace' : 'root'
  return (
    <AppShell>
      <AppShellInner>
        <AppShellContent>
          <div className={styles.AccessDenied()}>
            <Surface className={styles.AccessDenied.card()}>
              <h1 className={styles.AccessDenied.title()}>{title}</h1>
              <p className={styles.AccessDenied.message()}>
                Your current roles do not grant permission to read any {target}.
              </p>
              {canManageMembers && (
                <Button
                  appearance="plain"
                  intent="primary"
                  onPress={() => setRoute({page: 'users'})}
                >
                  Manage users
                </Button>
              )}
            </Surface>
          </div>
        </AppShellContent>
      </AppShellInner>
    </AppShell>
  )
}
