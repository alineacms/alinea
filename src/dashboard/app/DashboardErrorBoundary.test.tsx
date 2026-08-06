import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, spyOn, test} from 'bun:test'
import {Provider} from 'jotai'
import type {ReactNode} from 'react'
import {DashboardErrorBoundary} from './DashboardErrorBoundary.js'

afterEach(cleanup)

function BrokenDashboard(): ReactNode {
  throw new Error('Dashboard data failed to load')
}

test('shows dashboard load failures inside the app', () => {
  const consoleError = spyOn(console, 'error').mockImplementation(() => {})
  try {
    render(
      <Provider>
        <DashboardErrorBoundary>
          <BrokenDashboard />
        </DashboardErrorBoundary>
      </Provider>
    )
  } finally {
    consoleError.mockRestore()
  }

  expect(
    screen.getByRole('heading', {name: 'Oops, something went wrong'})
  ).toBeDefined()
  expect(screen.getByText('Dashboard data failed to load')).toBeDefined()
})
