import {PropsWithChildren} from 'react'
import useErrorBoundary from 'use-error-boundary'
import {ErrorMessage} from './ErrorMessage'

export function ErrorBoundary({children}: PropsWithChildren<{}>) {
  const {ErrorBoundary, didCatch, error} = useErrorBoundary()
  return (
    <>
      {didCatch ? (
        <ErrorMessage error={error} />
      ) : (
        <ErrorBoundary>{children}</ErrorBoundary>
      )}
    </>
  )
}
