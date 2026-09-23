import type {User} from '#/core/User.js'
import {LocalDB} from '#/database/LocalDB.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {dashboardTestConfig} from '#test/DashboardFixture.js'
import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, spyOn, test} from 'bun:test'
import {Provider, useAtomValueRaw} from 'jotai'
import type {AppProps} from '../App.js'
import {localUserAtom, useDashboardStore} from './core.js'

afterEach(cleanup)

interface AppHarnessProps {
  props: AppProps
}

function AppHarness({props}: AppHarnessProps) {
  const store = useDashboardStore(props)
  return (
    <Provider store={store}>
      <LocalUserName />
    </Provider>
  )
}

function LocalUserName() {
  const user = useAtomValueRaw(localUserAtom)
  return <span data-testid="user">{user?.name}</span>
}

function testUser(name: string): User {
  return {sub: name, name, roles: ['admin']}
}

test('syncs app prop changes without updating subscribers during render', async () => {
  const db = new LocalDB(dashboardTestConfig)
  await db.sync()
  const props: AppProps = {
    config: dashboardTestConfig,
    graph: db,
    events: new EventTarget(),
    client: createTestConnection(db),
    views: {},
    local: true,
    user: testUser('Ada')
  }
  const errors = spyOn(console, 'error')
  try {
    const view = render(<AppHarness props={props} />)
    expect(screen.getByTestId('user').textContent).toBe('Ada')

    view.rerender(<AppHarness props={{...props, user: testUser('Grace')}} />)

    expect(screen.getByTestId('user').textContent).toBe('Grace')
    const renderWarnings = errors.mock.calls.filter(args =>
      String(args[0]).includes('Cannot update a component')
    )
    expect(renderWarnings).toHaveLength(0)
  } finally {
    errors.mockRestore()
  }
})
