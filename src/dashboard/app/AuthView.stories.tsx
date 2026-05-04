import {AuthResultType} from 'alinea/cloud/AuthResult'
import {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import type {User} from 'alinea/core/User'
import 'alinea/theme.css'
import type {CSSProperties} from 'react'
import {useMemo, useState} from 'react'
import {AuthView} from './AuthView.js'

const config = {schema: {}, workspaces: {}} as Config
const user: User = {
  sub: 'editor',
  name: 'Editor',
  roles: ['admin']
}

const storyStyle: CSSProperties = {
  height: 520,
  minWidth: 640,
  border: '1px solid var(--alinea-border-default)'
}

function createClient() {
  return new Client({config, url: 'https://example.com/api'})
}

export function Loading() {
  const client = useMemo(() => {
    const client = createClient()
    client.authStatus = function authStatus() {
      return new Promise(() => {})
    }
    return client
  }, [])
  return (
    <div style={storyStyle}>
      <AuthView client={client} onAuthenticated={() => {}} />
    </div>
  )
}

export function DeployedWithoutHandler() {
  const client = useMemo(() => {
    const client = createClient()
    client.authStatus = function authStatus() {
      return Promise.reject(new Error('Missing handler'))
    }
    return client
  }, [])
  return (
    <div style={storyStyle}>
      <AuthView client={client} onAuthenticated={() => {}} />
    </div>
  )
}

export function MissingApiKey() {
  const client = useMemo(() => {
    const client = createClient()
    client.authStatus = function authStatus() {
      return Promise.resolve({
        type: AuthResultType.MissingApiKey,
        setupUrl: 'https://app.alinea.cloud/setup'
      })
    }
    return client
  }, [])
  return (
    <div style={storyStyle}>
      <AuthView client={client} onAuthenticated={() => {}} />
    </div>
  )
}

export function Authenticated() {
  const [authenticatedUser, setAuthenticatedUser] = useState<User>()
  const client = useMemo(() => {
    const client = createClient()
    client.authStatus = function authStatus() {
      return Promise.resolve({
        type: AuthResultType.Authenticated,
        user
      })
    }
    return client
  }, [])
  return (
    <div style={storyStyle}>
      {authenticatedUser ? (
        <div style={{padding: 24}}>Authenticated as {authenticatedUser.name}</div>
      ) : (
        <AuthView client={client} onAuthenticated={setAuthenticatedUser} />
      )}
    </div>
  )
}

export default {
  title: 'Dashboard / AuthView'
}
