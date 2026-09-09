import {act, cleanup, render, screen} from '#test/react.js'
import {localUser} from '#/core/User.js'
import {afterEach, expect, test} from 'bun:test'
import {atom, createStore, Provider} from 'jotai'
import type {DashboardAuthAction, DashboardAuthState} from '../atoms/auth.js'
import {AuthView} from './AuthView.js'

afterEach(cleanup)

test('keeps loading visible while the authenticated dashboard starts', () => {
  const authState = atom<DashboardAuthState>({status: 'loading'})
  const auth = atom(
    get => get(authState),
    (_get, _set, _action?: DashboardAuthAction) => {}
  )
  const store = createStore()

  render(
    <Provider store={store}>
      <AuthView auth={auth} />
    </Provider>
  )

  expect(screen.getByRole('progressbar', {name: 'Loading'})).toBeDefined()

  act(() => {
    store.set(authState, {status: 'authenticated', user: localUser})
  })

  expect(screen.getByRole('progressbar', {name: 'Loading'})).toBeDefined()
})
