import {lazy, Suspense} from 'react'

const Scenario = lazy(async () => {
  const module = await import('./AccessDeniedScenario.js')
  return {default: module.AccessDeniedScenario}
})

const UserScenario = lazy(async () => {
  const module = await import('./AccessDeniedScenario.js')
  return {default: module.UserAccessDeniedScenario}
})

export function AccessDeniedScenarioMount() {
  return (
    <Suspense fallback={null}>
      <Scenario />
    </Suspense>
  )
}

export function UserAccessDeniedScenarioMount() {
  return (
    <Suspense fallback={null}>
      <UserScenario />
    </Suspense>
  )
}
