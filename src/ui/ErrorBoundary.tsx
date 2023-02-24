import {PropsWithChildren, useEffect} from 'react'
import useErrorBoundary from 'use-error-boundary'
import {Button} from './Button.js'
import css from './ErrorBoundary.module.scss'
import {Icon} from './Icon.js'
import {HStack, VStack} from './Stack.js'
import {Typo} from './Typo.js'
import {IcRoundClose} from './icons/IcRoundClose.js'
import {IcRoundOpenInNew} from './icons/IcRoundOpenInNew.js'
import {IcRoundWarning} from './icons/IcRoundWarning.js'
import {useLocation} from './util/HashRouter.js'
import {fromModule} from './util/Styler.js'

const styles = fromModule(css)

type ErrorBoundaryProps = PropsWithChildren<{
  dependencies?: ReadonlyArray<any>
}>

export function ErrorBoundary({children, dependencies}: ErrorBoundaryProps) {
  const {ErrorBoundary, didCatch, error, reset} = useErrorBoundary()
  const location = useLocation()
  useEffect(() => {
    // Let's retry once we navigate elsewhere
    if (error) reset()
  }, [location])
  useEffect(() => {
    if (error) reset()
  }, dependencies || [])
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
