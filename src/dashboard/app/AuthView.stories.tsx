import {AuthResultType} from 'alinea/cloud/AuthResult'
import {Client} from 'alinea/core/Client'
import type {Config} from 'alinea/core/Config'
import type {WriteableGraph} from 'alinea/core/db/WriteableGraph'
import type {User} from 'alinea/core/User'
import 'alinea/theme.css'
import {useAtomValue} from 'jotai'
import type {CSSProperties} from 'react'
import {useMemo} from 'react'
import {Dashboard} from '../store/Dashboard.js'
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

function createDashboard(client: Client) {
  return new Dashboard(
    {} as WriteableGraph,
    config,
    new EventTarget(),
    client,
    {}
  )
}

interface AuthStoryProps {
  dashboard: Dashboard
}

function AuthStory({dashboard}: AuthStoryProps) {
  const auth = useAtomValue(dashboard.auth)
  if (auth.status === 'authenticated') {
    return <div style={{padding: 24}}>Authenticated</div>
  }
  return <AuthView dashboard={dashboard} />
}

export function Loading() {
  const dashboard = useMemo(() => {
    const client = createClient()
    client.authStatus = function authStatus() {
      return new Promise(() => {})
    }
    return createDashboard(client)
  }, [])
  return (
    <div style={storyStyle}>
      <AuthView dashboard={dashboard} />
    </div>
  )
}

export function DeployedWithoutHandler() {
  const dashboard = useMemo(() => {
    const client = createClient()
    client.authStatus = function authStatus() {
      return Promise.reject(new Error('Missing handler'))
    }
    return createDashboard(client)
  }, [])
  return (
    <div style={storyStyle}>
      <AuthView dashboard={dashboard} />
    </div>
  )
}

export function MissingApiKey() {
  const dashboard = useMemo(() => {
    const client = createClient()
    client.authStatus = function authStatus() {
      return Promise.resolve({
        type: AuthResultType.MissingApiKey,
        setupUrl: 'https://app.alinea.cloud/setup'
      })
    }
    return createDashboard(client)
  }, [])
  return (
    <div style={storyStyle}>
      <AuthView dashboard={dashboard} />
    </div>
  )
}

export function Authenticated() {
  const dashboard = useMemo(() => {
    const client = createClient()
    client.authStatus = function authStatus() {
      return Promise.resolve({
        type: AuthResultType.Authenticated,
        user
      })
    }
    return createDashboard(client)
  }, [])
  return (
    <div style={storyStyle}>
      <AuthStory dashboard={dashboard} />
    </div>
  )
}

export default {
  title: 'Dashboard / AuthView'
}
