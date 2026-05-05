import {cleanup, render, screen, waitFor} from '#test/react.js'
import {AuthResultType} from 'alinea/cloud/AuthResult'
import {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import type {User} from 'alinea/core/User'
import {afterEach, expect, test} from 'bun:test'
import {useAtomValue} from 'jotai'
import {Dashboard} from '../store/Dashboard.js'
import {AuthView} from './AuthView.js'

afterEach(cleanup)

const config = {schema: {}, workspaces: {}} as Config

function createClient() {
  return new Client({config, url: 'https://example.com/api'})
}

function createDashboard(client: Client) {
  return new Dashboard(
    {} as WriteableGraph,
    config,
    new EventTarget(),
    client,
    {}
  )
}

interface AuthProbeProps {
  dashboard: Dashboard
}

function AuthProbe({dashboard}: AuthProbeProps) {
  const auth = useAtomValue(dashboard.auth)
  if (auth.status === 'authenticated') return <div>Authenticated</div>
  return <AuthView dashboard={dashboard} />
}

test('AuthView shows the deployed handler notice when auth status fails', async () => {
  const client = createClient()
  client.authStatus = () => Promise.reject(new Error('missing handler'))
  const dashboard = createDashboard(client)

  render(<AuthView dashboard={dashboard} />)

  expect(
    await screen.findByRole('heading', {name: 'Ready to deploy?'})
  ).toBeTruthy()
  expect(screen.getByText('handler')).toBeTruthy()
})

test('AuthView shows cloud setup when the backend has no api key', async () => {
  const client = createClient()
  client.authStatus = () =>
    Promise.resolve({
      type: AuthResultType.MissingApiKey,
      setupUrl: 'https://app.alinea.cloud/setup'
    })
  const dashboard = createDashboard(client)

  render(<AuthView dashboard={dashboard} />)

  expect(
    await screen.findByRole('button', {name: 'Continue with alinea.cloud'})
  ).toBeTruthy()
  expect(screen.getByText(/requires a backend/)).toBeTruthy()
})

test('AuthView reports the authenticated user', async () => {
  const user: User = {sub: '123', name: 'Editor', roles: ['admin']}
  const client = createClient()
  client.authStatus = () =>
    Promise.resolve({
      type: AuthResultType.Authenticated,
      user
    })
  const dashboard = createDashboard(client)

  render(<AuthProbe dashboard={dashboard} />)

  await waitFor(() =>
    expect(screen.getByText('Authenticated')).toBeTruthy()
  )
})
