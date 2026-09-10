import '#test/react.js'
import {AuthResultType, type AuthResult} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import {localUser} from '#/core/User.js'
import {Config} from '#/index.js'
import {expect, test} from 'bun:test'
import {createStore} from 'jotai'
import {LocalDB} from '#/core/db/LocalDB.js'
import {authAtom, setUserRolesAtom} from './auth.js'
import {alineaDevAtom, clientAtom, localAtom, graphAtom} from './core.js'

test('preserves an authenticated user in local mode', async () => {
  const store = createStore()
  store.set(alineaDevAtom, false)
  store.set(localAtom, true)

  expect(store.get(authAtom)).toEqual({
    status: 'authenticated',
    user: localUser
  })

  store.set(setUserRolesAtom, ['editor', 'custom-role'])

  expect(store.get(authAtom)).toEqual({
    status: 'authenticated',
    user: {...localUser, roles: ['editor', 'custom-role']}
  })
})

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
  store.set(graphAtom, new LocalDB(config))
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

test('an older authentication response cannot overwrite a newer verified user', async () => {
  const config = Config.create({schema: {}, workspaces: {}})
  const client = new Client({config, url: '/api/cms'})
  const first = Promise.withResolvers<AuthResult>()
  let calls = 0
  client.authStatus = async () =>
    ++calls === 1
      ? first.promise
      : {type: AuthResultType.Authenticated, user: {...localUser, sub: 'new'}}
  const store = createStore()
  store.set(localAtom, false)
  store.set(alineaDevAtom, false)
  store.set(clientAtom, client)
  store.set(graphAtom, new LocalDB(config))
  const old = store.set(authAtom, {type: 'check'})
  await store.set(authAtom, {type: 'check'})
  first.resolve({
    type: AuthResultType.Authenticated,
    user: {...localUser, sub: 'old'}
  })
  await old
  expect(store.get(authAtom)).toMatchObject({
    status: 'authenticated',
    user: {sub: 'new'}
  })
})
