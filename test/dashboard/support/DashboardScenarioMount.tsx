import {lazy, Suspense} from 'react'

const Scenario = lazy(async () => {
  const module = await import('./DashboardScenario.js')
  return {default: module.DashboardScenario}
})

export function DashboardScenarioMount() {
  return (
    <Suspense fallback={null}>
      <Scenario />
    </Suspense>
  )
}
