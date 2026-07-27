import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {DashboardScopeInternal, useDashboard} from './hooks.js'
import type {Dashboard} from './store/Dashboard.js'

afterEach(cleanup)

interface DashboardIdentityProps {
  expected: Dashboard
  label: string
}

function DashboardIdentity({expected, label}: DashboardIdentityProps) {
  const dashboard = useDashboard()
  return <span>{dashboard === expected ? label : 'wrong dashboard'}</span>
}

test('dashboard scopes isolate dashboard instances', () => {
  const first = {id: 'first'} as unknown as Dashboard
  const second = {id: 'second'} as unknown as Dashboard

  render(
    <>
      <DashboardScopeInternal dashboard={first}>
        <DashboardIdentity expected={first} label="first dashboard" />
      </DashboardScopeInternal>
      <DashboardScopeInternal dashboard={second}>
        <DashboardIdentity expected={second} label="second dashboard" />
      </DashboardScopeInternal>
    </>
  )

  expect(screen.getByText('first dashboard')).toBeDefined()
  expect(screen.getByText('second dashboard')).toBeDefined()
  expect(screen.queryByText('wrong dashboard')).toBeNull()
})
