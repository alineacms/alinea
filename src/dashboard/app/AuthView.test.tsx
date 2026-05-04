import {cleanup, render, screen, waitFor} from '#test/react.js'
import {AuthResultType} from 'alinea/cloud/AuthResult'
import {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import type {User} from 'alinea/core/User'
import {afterEach, expect, test} from 'bun:test'
import {AuthView} from './AuthView.js'

afterEach(cleanup)

const config = {schema: {}, workspaces: {}} as Config

function createClient() {
  return new Client({config, url: 'https://example.com/api'})
}

test('AuthView shows the deployed handler notice when auth status fails', async () => {
  const client = createClient()
  client.authStatus = () => Promise.reject(new Error('missing handler'))

  render(<AuthView client={client} onAuthenticated={() => {}} />)

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

  render(<AuthView client={client} onAuthenticated={() => {}} />)

  expect(
    await screen.findByRole('button', {name: 'Continue with alinea.cloud'})
  ).toBeTruthy()
  expect(screen.getByText(/requires a backend/)).toBeTruthy()
})

test('AuthView reports the authenticated user', async () => {
  const user: User = {sub: '123', name: 'Editor', roles: ['admin']}
  const client = createClient()
  let received: User | undefined
  client.authStatus = () =>
    Promise.resolve({
      type: AuthResultType.Authenticated,
      user
    })

  render(<AuthView client={client} onAuthenticated={next => (received = next)} />)
  await waitFor(() => expect(received).toEqual(user))

  expect(received).toEqual(user)
})
