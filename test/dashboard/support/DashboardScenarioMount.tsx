import {lazy, Suspense} from 'react'
import type {DashboardScenarioProps} from './DashboardScenario.js'

const Scenario = lazy(async () => {
  const module = await import('./DashboardScenario.js')
  return {default: module.DashboardScenario}
})

export function DashboardScenarioMount(props: DashboardScenarioProps) {
  return (
    <Suspense fallback={null}>
      <Scenario {...props} />
    </Suspense>
  )
}
