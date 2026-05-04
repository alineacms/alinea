import styler from '@alinea/styler'
import {AuthResultType, type AuthResult} from 'alinea/cloud/AuthResult'
import {Button, Link, ProgressCircle} from 'alinea/components'
import {Client} from 'alinea/core/Client'
import type {LocalConnection} from 'alinea/core/Connection'
import type {User} from 'alinea/core/User'
import {useEffect, useState, type ReactNode} from 'react'
import {
  IcRoundArrowForward,
  IcRoundPublish
} from '../icons.js'
import css from './AuthView.module.css'

const styles = styler(css)

export interface AuthViewProps {
  client: LocalConnection
  onAuthenticated: (user: User) => void
}

type AuthViewState =
  | {status: 'loading'}
  | {status: 'missingHandler'}
  | {status: 'ready'; result: AuthResult}

export function AuthView({client, onAuthenticated}: AuthViewProps) {
  const [state, setState] = useState<AuthViewState>({status: 'loading'})

  if (!(client instanceof Client)) {
    throw new Error('Cannot authenticate with non http client')
  }

  useEffect(() => {
    let ignore = false
    setState({status: 'loading'})
    client
      .authStatus()
      .then(result => {
        if (!ignore) setState({status: 'ready', result})
      })
      .catch(() => {
        if (!ignore) setState({status: 'missingHandler'})
      })
    return () => {
      ignore = true
    }
  }, [client])

  useEffect(() => {
    if (
      state.status === 'ready' &&
      state.result.type === AuthResultType.Authenticated
    ) {
      onAuthenticated(state.result.user)
    }
  }, [onAuthenticated, state])

  if (state.status === 'loading') {
    return <AuthViewLoader />
  }

  if (state.status === 'missingHandler') {
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

  const {location} = window
  const from = encodeURIComponent(
    `${location.protocol}//${location.host}${location.pathname}`
  )

  switch (state.result.type) {
    case AuthResultType.NeedsRefresh:
      throw new Error('Authentication failure, please refresh the page')
    case AuthResultType.Authenticated:
      return null
    case AuthResultType.UnAuthenticated:
      location.href = `${state.result.redirect}&from=${from}`
      return null
    case AuthResultType.MissingApiKey: {
      const {setupUrl} = state.result
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
              onPress={() => {
                location.href = `${setupUrl}?from=${from}`
              }}
            >
              Continue with alinea.cloud
            </Button>
          </div>
        </AuthViewFrame>
      )
    }
  }
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
        <section className={styles.AuthView.surface()}>
          <div className={styles.AuthView.heading()}>
            <span className={styles.AuthView.mark()}>
              <IcRoundPublish />
            </span>
            <h1 className={styles.AuthView.title()}>{title}</h1>
          </div>
          {children}
        </section>
      </div>
    </div>
  )
}
