import {lazy, Suspense} from 'react'

const Scenario = lazy(async () => {
  const module = await import('./LinkFieldScenario.js')
  return {default: module.LinkFieldScenario}
})

export function LinkFieldScenarioMount() {
  return (
    <Suspense fallback={null}>
      <Scenario />
    </Suspense>
  )
}
