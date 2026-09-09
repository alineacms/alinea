import {Button, Icon, Surface} from '#/components.js'
import {MissingEntryError} from '#/dashboard/atoms/entry.js'
import {routeAtom, routeGuardAtom} from '#/dashboard/atoms/nav.js'
import {styler} from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {useEffect, useRef, type PropsWithChildren} from 'react'
import useErrorBoundary from 'use-error-boundary'
import {IcRoundWarning} from '../icons.js'
import css from './DashboardErrorBoundary.module.css'

const styles = styler(css)

export function DashboardErrorBoundary({children}: PropsWithChildren) {
  const route = useAtomValueRaw(routeAtom)
  const routeKey = JSON.stringify(route)
  return (
    <DashboardRouteErrorBoundary routeKey={routeKey}>
      {children}
    </DashboardRouteErrorBoundary>
  )
}

interface DashboardRouteErrorBoundaryProps extends PropsWithChildren {
  routeKey: string
}

function DashboardRouteErrorBoundary({
  children,
  routeKey
}: DashboardRouteErrorBoundaryProps) {
  const {ErrorBoundary, didCatch, error, reset} = useErrorBoundary()
  const route = useAtomValueRaw(routeAtom)
  const setRoute = useSetAtom(routeAtom)
  const setRouteGuard = useSetAtom(routeGuardAtom)
  const previousRouteKey = useRef(routeKey)
  // oxlint-disable react-you-might-not-need-an-effect/no-event-handler -- The boundary exposes an imperative reset API, and recovery must follow a route change after an error.
  useEffect(() => {
    const routeChanged = previousRouteKey.current !== routeKey
    previousRouteKey.current = routeKey
    if (routeChanged && didCatch) reset()
  }, [didCatch, reset, routeKey])
  // oxlint-enable react-you-might-not-need-an-effect/no-event-handler
  useEffect(() => {
    if (!(error instanceof MissingEntryError) || route.entry !== error.id)
      return
    setRouteGuard(null)
    setRoute({...route, entry: undefined, view: undefined})
  }, [error, route, setRoute, setRouteGuard])
  if (didCatch && error instanceof MissingEntryError) return null
  if (didCatch) {
    const message = errorMessage(error)
    return (
      <div className={styles.DashboardErrorBoundary()}>
        <Surface className={styles.DashboardErrorBoundary.card()}>
          <div className={styles.DashboardErrorBoundary.heading()}>
            <Icon icon={IcRoundWarning} />
            <h1 className={styles.DashboardErrorBoundary.title()}>
              Oops, something went wrong
            </h1>
          </div>
          <pre className={styles.DashboardErrorBoundary.message()}>
            {message}
          </pre>
          <div className={styles.DashboardErrorBoundary.actions()}>
            <Button intent="primary" onPress={reloadDashboard}>
              Reload dashboard
            </Button>
          </div>
        </Surface>
      </div>
    )
  }
  return <ErrorBoundary>{children}</ErrorBoundary>
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  if (!(error.cause instanceof Error)) return error.message
  return `${error.message}\nCaused by: ${error.cause.message}`
}

function reloadDashboard() {
  window.location.reload()
}
