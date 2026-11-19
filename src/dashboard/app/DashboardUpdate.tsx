import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
  Button
} from '#/components.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
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
// A tab out of view checks again, as its changes settle or that time passes
const checkInterval = 60_000

function reloadedRecently(): boolean {
  try {
    const reloadedAt = Number(sessionStorage.getItem(reloadedKey))
    return Date.now() - reloadedAt < reloadInterval
  } catch {
    return false
  }
}

/** A dialog can hold input the route guard does not know of. */
function hasOpenDialog(): boolean {
  return (
    document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  )
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
  const hasUnsavedChanges = useAtomValueRaw(hasUnsavedChangesAtom)
  const canReloadSafely = useSetAtom(canReloadSafelyAtom)

  useEffect(() => {
    if (!outdated) return
    let reloading = false
    async function reloadOutOfView() {
      if (reloading || document.visibilityState !== 'hidden') return
      if (reloadedRecently() || hasOpenDialog()) return
      if (!(await canReloadSafely())) return
      // Still out of view once the activities are known
      if (reloading || document.visibilityState !== 'hidden') return
      reloading = true
      reload()
    }
    void reloadOutOfView()
    const check = () => void reloadOutOfView()
    document.addEventListener('visibilitychange', check)
    const interval = setInterval(check, checkInterval)
    return () => {
      document.removeEventListener('visibilitychange', check)
      clearInterval(interval)
    }
  }, [outdated, canReloadSafely])

  if (!outdated) return null

  async function reloadOnRequest() {
    if (
      !(await canReloadSafely()) &&
      !window.confirm(
        'Reload the dashboard? Changes that are not saved yet will be lost.'
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
          <Button
            size="sm"
            icon={IcRoundRefresh}
            onClick={() => void reloadOnRequest()}
          >
            Reload
          </Button>
        </AlertActions>
      </Alert>
    </div>
  )
}
