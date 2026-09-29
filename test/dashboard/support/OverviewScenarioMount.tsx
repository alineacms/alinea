import {lazy, Suspense} from 'react'

const Scenario = lazy(async () => {
  const module = await import('./OverviewScenario.js')
  return {default: module.OverviewScenario}
})

export function OverviewScenarioMount() {
  return (
    <Suspense fallback={null}>
      <Scenario />
    </Suspense>
  )
}
