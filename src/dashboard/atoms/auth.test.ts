import '#test/react.js'
import {AuthResultType, type AuthResult} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import {Config} from '#/index.js'
import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import {authAtom} from './auth.js'
import {alineaDevAtom, clientAtom, localAtom} from './core.js'

test('continues from a missing API key to cloud setup', async () => {
  const config = Config.create({schema: {}, workspaces: {}})
  const client = new Client({config, url: '/api/cms'})
  client.authStatus = async (): Promise<AuthResult> => ({
    type: AuthResultType.MissingApiKey,
    setupUrl: 'about:blank?setup=1'
  })
  const store = createStore()
  store.set(alineaDevAtom, false)
  store.set(localAtom, false)
  store.set(clientAtom, client)
  window.location.href = 'about:blank'
  await store.set(authAtom, {type: 'check'})
  expect(store.get(authAtom)).toEqual({
    status: 'missingApiKey',
    setupUrl: 'about:blank?setup=1'
  })

  await store.set(authAtom, {type: 'setupCloud'})

  expect(store.get(authAtom)).toEqual({
    status: 'missingApiKey',
    setupUrl: 'about:blank?setup=1'
  })
  expect(window.location.href).toBe(
    'about:blank?setup=1&from=about%3A%2F%2Fblank'
  )
})
