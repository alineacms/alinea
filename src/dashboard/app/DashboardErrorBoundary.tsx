import {Icon, Surface} from '#/components.js'
import {MissingEntryError} from '#/dashboard/atoms/entry.js'
import {routeAtom, routeGuardAtom} from '#/dashboard/atoms/nav.js'
import {styler} from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import {useEffect, useRef, type PropsWithChildren} from 'react'
import useErrorBoundary from 'use-error-boundary'
import {IcRoundWarning} from '../icons.js'
import css from './DashboardErrorBoundary.module.css'

const styles = styler(css)

export function DashboardErrorBoundary({children}: PropsWithChildren) {
  const route = useAtomValue(routeAtom)
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
  const route = useAtomValue(routeAtom)
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
    const message = error instanceof Error ? error.message : String(error)
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
        </Surface>
      </div>
    )
  }
  return <ErrorBoundary>{children}</ErrorBoundary>
}
