import '#/theme.css'
import type {
  DashboardAuthAction,
  DashboardAuthState
} from '#/dashboard/atoms/auth.js'
import {atom} from 'jotai'
import type {CSSProperties, ReactNode} from 'react'
import {AuthView} from './AuthView.js'

const storyStyle: CSSProperties = {
  height: 520,
  minHeight: 520
}

interface AuthViewStoryProps {
  state: DashboardAuthState
  children?: ReactNode
}

function createAuthAtom(state: DashboardAuthState) {
  const authState = atom(state)
  return atom(
    get => get(authState),
    (get, set, action: DashboardAuthAction = {type: 'check'}) => {
      if (action.type === 'setupCloud') set(authState, {status: 'redirecting'})
    }
  )
}

function AuthViewStory({state, children}: AuthViewStoryProps) {
  const auth = createAuthAtom(state)
  return (
    <div style={storyStyle}>
      <AuthView auth={auth} />
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
