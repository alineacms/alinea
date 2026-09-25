import '#test/react.js'
import {expect, test} from 'bun:test'
import {atom, createStore, Provider, useAtomValueRaw} from 'jotai'
import {unwrap} from 'jotai/utils'
import {startTransition} from 'react'
import {createRoot} from 'react-dom/client'

interface ActEnvironment {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}

// Jotai 3 subscribes in an effect without checking the value again, we patch
// it (patches/jotai@3.0.0.patch) so a component does not miss a change that
// happened between rendering and subscribing
test('renders an unwrapped atom that resolved before the component subscribed', async () => {
  // Let React schedule passive effects the way it does in the browser, after
  // the promise below has already resolved
  const environment = globalThis as ActEnvironment
  const isActEnvironment = environment.IS_REACT_ACT_ENVIRONMENT
  environment.IS_REACT_ACT_ENVIRONMENT = false
  const store = createStore()
  const state = unwrap(
    atom(async () => 'ready'),
    () => 'loading'
  )
  function View() {
    return <span>{useAtomValueRaw(state)}</span>
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    startTransition(() => {
      root.render(
        <Provider store={store}>
          <View />
        </Provider>
      )
    })
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(store.get(state)).toBe('ready')
    expect(container.textContent).toBe('ready')
  } finally {
    root.unmount()
    container.remove()
    environment.IS_REACT_ACT_ENVIRONMENT = isActEnvironment
  }
})
