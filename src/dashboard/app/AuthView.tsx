import {Button, Link, ProgressCircle, Surface} from '#/components.js'
import styler from '@alinea/styler'
import {useAtomValue, useSetAtom} from 'jotai'
import type {ReactNode} from 'react'
import {IcRoundArrowForward, IcRoundPublish} from '../icons.js'
import type {Dashboard} from '../store/Dashboard.js'
import css from './AuthView.module.css'

const styles = styler(css)

export interface AuthViewProps {
  dashboard: Dashboard
}

export function AuthView({dashboard}: AuthViewProps) {
  const auth = useAtomValue(dashboard.auth)
  const setAuth = useSetAtom(dashboard.auth)

  if (auth.status === 'loading' || auth.status === 'redirecting') {
    return <AuthViewLoader />
  }

  if (auth.status === 'error') {
    throw auth.error
  }

  if (auth.status === 'authenticated') {
    return null
  }

  if (auth.status === 'missingHandler') {
    return (
      <AuthViewFrame title="Ready to deploy?">
        <p className={styles.AuthView.text()}>
          Alinea requires a{' '}
          <Link
            className={styles.AuthView.link()}
            href="https://alineacms.com/docs/deploy"
            target="_blank"
          >
            handler
          </Link>{' '}
          to continue.
        </p>
      </AuthViewFrame>
    )
  }

  return (
    <AuthViewFrame title="Ready to deploy?">
      <p className={styles.AuthView.text()}>
        Alinea requires a backend to continue. You can{' '}
        <Link
          className={styles.AuthView.link()}
          href="https://alineacms.com/docs/deploy"
          target="_blank"
        >
          fully configure a custom backend
        </Link>
        , or get set up with alinea.cloud.
      </p>
      <div className={styles.AuthView.actionRow()}>
        <Button
          intent="primary"
          icon={IcRoundArrowForward}
          onPress={() => setAuth({type: 'setupCloud'})}
        >
          Continue with alinea.cloud
        </Button>
      </div>
    </AuthViewFrame>
  )
}

function AuthViewLoader() {
  return (
    <div className={styles.AuthView()}>
      <div className={styles.AuthView.panel()}>
        <div className={styles.AuthView.loader()}>
          <ProgressCircle isIndeterminate aria-label="Checking sign in" />
        </div>
      </div>
    </div>
  )
}

interface AuthViewFrameProps {
  title: string
  children: ReactNode
}

function AuthViewFrame({title, children}: AuthViewFrameProps) {
  return (
    <div className={styles.AuthView()}>
      <div className={styles.AuthView.panel()}>
        <Surface className={styles.AuthView.surface()}>
          <div className={styles.AuthView.heading()}>
            <span className={styles.AuthView.mark()}>
              <IcRoundPublish />
            </span>
            <h1 className={styles.AuthView.title()}>{title}</h1>
          </div>
          {children}
        </Surface>
      </div>
    </div>
  )
}
