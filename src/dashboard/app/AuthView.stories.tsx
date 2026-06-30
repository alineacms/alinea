import '#/theme.css'
import {atom, type WritableAtom} from 'jotai'
import type {CSSProperties, ReactNode} from 'react'
import type {Dashboard, DashboardAuthState} from '../store/Dashboard.js'
import {AuthView} from './AuthView.js'

interface StoryAuthCheck {
  type: 'check'
}

interface StoryAuthSetupCloud {
  type: 'setupCloud'
}

type StoryAuthAction = StoryAuthCheck | StoryAuthSetupCloud

interface StoryDashboard {
  auth: WritableAtom<DashboardAuthState, [action?: StoryAuthAction], void>
}

const storyStyle: CSSProperties = {
  height: 520,
  minHeight: 520
}

const emptyStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  height: '100%',
  color: 'var(--alinea-fg-muted)',
  fontSize: 'var(--alinea-font-size-base)'
}

interface AuthViewStoryProps {
  state: DashboardAuthState
  children?: ReactNode
}

function createDashboard(state: DashboardAuthState): Dashboard {
  const authState = atom<DashboardAuthState>(state)
  const dashboard = {
    auth: atom(
      get => get(authState),
      (get, set, action: StoryAuthAction = {type: 'check'}) => {
        if (action.type === 'setupCloud')
          set(authState, {status: 'redirecting'})
      }
    )
  } satisfies StoryDashboard
  return dashboard as unknown as Dashboard
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
