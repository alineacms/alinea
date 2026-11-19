import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  Button
} from '#/components.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw} from 'jotai'
import {useEffect} from 'react'
import {
  canReloadSafelyAtom,
  dashboardOutdatedAtom,
  hasUnsavedChangesAtom
} from '../atoms/version.js'
import {IcRoundRefresh} from '../icons.js'
import css from './DashboardUpdate.module.css'

const styles = styler(css)

const reloadedKey = 'alinea-reloaded-for-update'
// A dashboard still outdated this soon after reloading for an update (cached
// files, or a request answered by the previous deploy) does not reload again
const reloadInterval = 10 * 60_000

function reloadedRecently(): boolean {
  try {
    const reloadedAt = Number(sessionStorage.getItem(reloadedKey))
    return Date.now() - reloadedAt < reloadInterval
  } catch {
    return false
  }
}

function reload() {
  try {
    sessionStorage.setItem(reloadedKey, String(Date.now()))
  } catch {
    // Without storage a reload only happens on request
  }
  location.reload()
}

/**
 * Tells the user a new version of the dashboard was deployed. A tab out of
 * view reloads by itself when that loses nothing.
 */
export function DashboardUpdate() {
  const outdated = useAtomValueRaw(dashboardOutdatedAtom)
  const canReloadSafely = useAtomValueRaw(canReloadSafelyAtom)
  const hasUnsavedChanges = useAtomValueRaw(hasUnsavedChangesAtom)

  useEffect(() => {
    if (!outdated || !canReloadSafely || reloadedRecently()) return
    function reloadOutOfView() {
      if (document.visibilityState === 'hidden') reload()
    }
    reloadOutOfView()
    document.addEventListener('visibilitychange', reloadOutOfView)
    return () => {
      document.removeEventListener('visibilitychange', reloadOutOfView)
    }
  }, [outdated, canReloadSafely])

  if (!outdated) return null

  function reloadOnRequest() {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        'Reload the dashboard? Your unsaved changes will be lost.'
      )
    )
      return
    reload()
  }

  return (
    <div className={styles.DashboardUpdate()} data-slot="dashboard-update">
      <Alert
        className={styles.DashboardUpdate.alert()}
        variant="warning"
        icon={IcRoundRefresh}
      >
        <AlertTitle>A new version of the dashboard is available</AlertTitle>
        <AlertDescription>
          {hasUnsavedChanges
            ? 'Changes made in this version can not be saved. Copy any unsaved changes, then reload.'
            : 'Reload to keep editing: changes made in this version can not be saved.'}
        </AlertDescription>
        <AlertActions>
          <Button size="sm" icon={IcRoundRefresh} onClick={reloadOnRequest}>
            Reload
          </Button>
        </AlertActions>
      </Alert>
    </div>
  )
}
