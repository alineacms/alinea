import {Icon} from '#/components.js'
import {IcRoundWarning} from '#/v2/icons.js'
import {useDashboard} from '#/v2/store.js'
import styler from '@alinea/styler'
import {useAtomValue} from 'jotai'
import {useEffect, type PropsWithChildren} from 'react'
import useErrorBoundary from 'use-error-boundary'
import css from './ErrorBoundary.module.css'

const styles = styler(css)

type ErrorBoundaryProps = PropsWithChildren<{}>

export function ErrorBoundary({children}: ErrorBoundaryProps) {
  const {ErrorBoundary, didCatch, error, reset} = useErrorBoundary()
  const dashboard = useDashboard()
  const route = useAtomValue(dashboard.route)
  useEffect(() => {
    if (error) reset()
  }, [error, reset, route])
  return (
    <>
      {didCatch ? (
        <>
          <div className={styles.ErrorBoundary()}>
            <div className={styles.ErrorBoundary.inner()}>
              <header className={styles.ErrorBoundary.heading()}>
                <Icon icon={IcRoundWarning} />
                <h3>Oops, something went wrong</h3>
              </header>
              <div className={styles.ErrorBoundary.mesage()}>
                {error.message}
              </div>
            </div>
          </div>
        </>
      ) : (
        <ErrorBoundary>{children}</ErrorBoundary>
      )}
    </>
  )
}
