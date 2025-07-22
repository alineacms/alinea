import styler from '@alinea/styler'
import {Head} from 'alinea/dashboard/util/Head'
import {Button, HStack, Icon, Typo, VStack} from 'alinea/ui'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundOpenInNew} from 'alinea/ui/icons/IcRoundOpenInNew'
import {IcRoundWarning} from 'alinea/ui/icons/IcRoundWarning'
import {type PropsWithChildren, useEffect} from 'react'
import useErrorBoundary from 'use-error-boundary'
import {useTranslation} from '../hook/useTranslation.js'
import {useLocation} from '../util/HashRouter.js'
import css from './ErrorBoundary.module.scss'

const styles = styler(css)

export const copy = {
  title: 'Error',
  oops: 'Oops, something went wrong',
  close: 'Close error',
  issue: 'Create an issue'
}

type ErrorBoundaryProps = PropsWithChildren<{
  dependencies?: ReadonlyArray<any>
}>

export function ErrorBoundary({children, dependencies}: ErrorBoundaryProps) {
  const {ErrorBoundary, didCatch, error, reset} = useErrorBoundary()
  const t = useTranslation(copy)
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
        <>
          <Head>
            <title>{t.title}</title>
          </Head>
          <div className={styles.root()}>
            <VStack gap={16} className={styles.root.inner()}>
              <HStack gap={8} center>
                <Icon icon={IcRoundWarning} size={20} />
                <Typo.H3 flat>{t.oops}</Typo.H3>
              </HStack>
              <div className={styles.root.mesage()}>{error.message}</div>
              <HStack gap={16} center>
                <Button onClick={reset} icon={IcRoundClose}>
                  {t.close}
                </Button>
                <Typo.Link
                  href="https://github.com/alineacms/alinea/issues"
                  target="_blank"
                >
                  <HStack gap={8} center>
                    <span>{t.issue}</span>
                    <Icon icon={IcRoundOpenInNew} />
                  </HStack>
                </Typo.Link>
              </HStack>
            </VStack>
          </div>
        </>
      ) : (
        <ErrorBoundary>{children}</ErrorBoundary>
      )}
    </>
  )
}
