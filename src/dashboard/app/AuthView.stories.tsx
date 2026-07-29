import '#/theme.css'
import {atom} from 'jotai'
import type {CSSProperties, ReactNode} from 'react'
import type {
  AuthAction,
  AuthState as DashboardAuthState
} from '../atoms/AuthAtoms.js'
import {AuthView, type AuthViewProps} from './AuthView.js'

const storyStyle: CSSProperties = {
  height: 520,
  minHeight: 520
}

interface AuthViewStoryProps {
  state: DashboardAuthState
  children?: ReactNode
}

function createDashboard(
  state: DashboardAuthState
): AuthViewProps['dashboard'] {
  const authState = atom<DashboardAuthState>(state)
  return {
    auth: atom(
      get => get(authState),
      (get, set, action: AuthAction = {type: 'check'}) => {
        if (action.type === 'setupCloud')
          set(authState, {status: 'redirecting'})
      }
    )
  }
}

function AuthViewStory({state, children}: AuthViewStoryProps) {
  const dashboard = createDashboard(state)
  return (
    <div style={storyStyle}>
      <AuthView dashboard={dashboard} />
      {children}
    </div>
  )
}

export function Loading() {
  return <AuthViewStory state={{status: 'loading'}} />
}

export function MissingHandler() {
  return <AuthViewStory state={{status: 'missingHandler'}} />
}

export function MissingApiKey() {
  return (
    <AuthViewStory
      state={{
        status: 'missingApiKey',
        setupUrl: 'https://app.alinea.cloud/setup'
      }}
    />
  )
}

export default {
  title: 'Dashboard / AuthView'
}
