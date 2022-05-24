import {PropsWithChildren, useEffect} from 'react'
import {useLocation} from 'react-router-dom'
import useErrorBoundary from 'use-error-boundary'
import {Button} from './Button'
import css from './ErrorBoundary.module.scss'
import {Icon} from './Icon'
import IcRoundClose from './icons/IcRoundClose'
import IcRoundOpenInNew from './icons/IcRoundOpenInNew'
import IcRoundWarning from './icons/IcRoundWarning'
import {HStack, VStack} from './Stack'
import {Typo} from './Typo'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export function ErrorBoundary({children}: PropsWithChildren<{}>) {
  const {ErrorBoundary, didCatch, error, reset} = useErrorBoundary()
  const location = useLocation()
  useEffect(() => {
    // Let's retry once we navigate elsewhere
    if (error) reset()
  }, [location])
  return (
    <>
      {didCatch ? (
        <div className={styles.root()}>
          <VStack gap={16} className={styles.root.inner()}>
            <HStack gap={8} center>
              <Icon icon={IcRoundWarning} size={20} />
              <Typo.H3 flat>Oops, something went wrong</Typo.H3>
            </HStack>
            <div className={styles.root.mesage()}>{error.message}</div>
            <HStack gap={16} center>
              <Button onClick={reset} icon={IcRoundClose}>
                Close error
              </Button>
              <Typo.Link
                href="https://github.com/alineacms/alinea/issues"
                target="_blank"
              >
                <HStack gap={8} center>
                  <span>Create an issue</span>
                  <Icon icon={IcRoundOpenInNew} />
                </HStack>
              </Typo.Link>
            </HStack>
          </VStack>
        </div>
      ) : (
        <ErrorBoundary>{children}</ErrorBoundary>
      )}
    </>
  )
}
