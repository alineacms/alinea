import {Icon, Surface} from '#/components.js'
import {routeAtom} from '#/dashboard/atoms/nav.js'
import {styler} from '@alinea/styler'
import {useAtomValue} from 'jotai'
import type {PropsWithChildren} from 'react'
import useErrorBoundary from 'use-error-boundary'
import {IcRoundWarning} from '../icons.js'
import css from './DashboardErrorBoundary.module.css'

const styles = styler(css)

export function DashboardErrorBoundary({children}: PropsWithChildren) {
  const route = useAtomValue(routeAtom)
  const routeKey = JSON.stringify(route)
  return (
    <DashboardRouteErrorBoundary key={routeKey}>
      {children}
    </DashboardRouteErrorBoundary>
  )
}

function DashboardRouteErrorBoundary({children}: PropsWithChildren) {
  const {ErrorBoundary, didCatch, error} = useErrorBoundary()
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
