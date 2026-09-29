import {lazy, Suspense} from 'react'

const Fixture = lazy(async () => {
  const module = await import('./VisualScenario.js')
  return {default: module.FixtureScenario}
})

const Fields = lazy(async () => {
  const module = await import('./VisualScenario.js')
  return {default: module.FieldsScenario}
})

export function FixtureScenarioMount() {
  return (
    <Suspense fallback={null}>
      <Fixture />
    </Suspense>
  )
}

export function FieldsScenarioMount() {
  return (
    <Suspense fallback={null}>
      <Fields />
    </Suspense>
  )
}
