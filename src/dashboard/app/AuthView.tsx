import {
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Icon,
  Link,
  Spinner
} from '#/components.js'
import styler from '@alinea/styler'
import {useAtom, type WritableAtom} from 'jotai'
import type {ReactNode} from 'react'
import {
  authAtom,
  type DashboardAuthAction,
  type DashboardAuthState
} from '../atoms/auth.js'
import {IcRoundArrowForward, IcRoundPublish} from '../icons.js'
import css from './AuthView.module.css'

const styles = styler(css)

export interface AuthViewProps {
  auth?: WritableAtom<
    DashboardAuthState,
    [action?: DashboardAuthAction],
    unknown
  >
}

export function AuthView({auth: authState = authAtom}: AuthViewProps) {
  const [auth, setAuth] = useAtom(authState)
  const isLoading =
    auth.status === 'loading' ||
    auth.status === 'redirecting' ||
    auth.status === 'authenticated'

  if (isLoading) {
    return <AuthViewLoader />
  }

  if (auth.status === 'error') {
    throw auth.error
  }

  if (auth.status === 'missingHandler') {
    return (
      <AuthViewFrame
        title="Ready to deploy?"
        description={
          <>
            Alinea requires a{' '}
            <Link
              className={styles.AuthView.link()}
              href="https://alineacms.com/docs/deploy"
              target="_blank"
            >
              handler
            </Link>{' '}
            to continue.
          </>
        }
      />
    )
  }

  return (
    <AuthViewFrame
      title="Ready to deploy?"
      description={
        <>
          Alinea requires a backend to continue. You can{' '}
          <Link
            className={styles.AuthView.link()}
            href="https://alineacms.com/docs/deploy"
            target="_blank"
          >
            fully configure a custom backend
          </Link>
          , or get set up with alinea.cloud.
        </>
      }
    >
      <Button
        color="primary"
        icon={IcRoundArrowForward}
        onClick={() => setAuth({type: 'setupCloud'})}
      >
        Continue with alinea.cloud
      </Button>
    </AuthViewFrame>
  )
}

function AuthViewLoader() {
  return (
    <div className={styles.AuthView()}>
      <div className={styles.AuthView.panel()}>
        <div className={styles.AuthView.loader()}>
          <Spinner aria-label="Loading" />
        </div>
      </div>
    </div>
  )
}

interface AuthViewFrameProps {
  title: string
  description: ReactNode
  children?: ReactNode
}

function AuthViewFrame({title, description, children}: AuthViewFrameProps) {
  return (
    <div className={styles.AuthView()}>
      <div className={styles.AuthView.panel()}>
        <Empty variant="card">
          <EmptyHeader>
            <EmptyMedia variant="icon" className={styles.AuthView.mark()}>
              <Icon icon={IcRoundPublish} />
            </EmptyMedia>
            <EmptyTitle as="h1">{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
          {children && <EmptyContent>{children}</EmptyContent>}
        </Empty>
      </div>
    </div>
  )
}
