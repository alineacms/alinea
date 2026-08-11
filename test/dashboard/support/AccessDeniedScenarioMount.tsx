import {lazy, Suspense} from 'react'

const Scenario = lazy(async () => {
  const module = await import('./AccessDeniedScenario.js')
  return {default: module.AccessDeniedScenario}
})

export function AccessDeniedScenarioMount() {
  return (
    <Suspense fallback={null}>
      <Scenario />
    </Suspense>
  )
}
