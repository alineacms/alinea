import type {
  DashboardAuthAction,
  DashboardAuthState
} from '#/dashboard/atoms/auth.js'
import {AuthView} from '#/dashboard/app/AuthView.js'
import {atom} from 'jotai'
import {useState} from 'react'

interface AuthScenarioProps {
  state: DashboardAuthState
}

function AuthScenario({state}: AuthScenarioProps) {
  const [auth] = useState(() => {
    const authState = atom(state)
    return atom(
      get => get(authState),
      (_get, _set, _action: DashboardAuthAction = {type: 'check'}) => {}
    )
  })
  return (
    <div style={{height: '100vh'}}>
      <AuthView auth={auth} />
    </div>
  )
}

export function MissingHandlerScenario() {
  return <AuthScenario state={{status: 'missingHandler'}} />
}

export function MissingApiKeyScenario() {
  return (
    <AuthScenario
      state={{
        status: 'missingApiKey',
        setupUrl: 'https://app.alinea.cloud/setup'
      }}
    />
  )
}
