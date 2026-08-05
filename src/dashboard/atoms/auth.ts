import {AuthResultType} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import {localUser, User} from '#/core/User.js'
import {atom} from 'jotai'
import {alineaDevAtom, clientAtom, localAtom} from './core.js'

export const authRequiredAtom = atom(get => {
  const forceAuth =
    typeof process !== 'undefined' && process.env.ALINEA_FORCE_AUTH
  if (forceAuth) return true
  return !(get(alineaDevAtom) || get(localAtom))
})

export interface DashboardAuthLoading {
  status: 'loading'
}

export interface DashboardAuthMissingHandler {
  status: 'missingHandler'
}

export interface DashboardAuthMissingApiKey {
  status: 'missingApiKey'
  setupUrl: string
}

export interface DashboardAuthRedirecting {
  status: 'redirecting'
}

export interface DashboardAuthError {
  status: 'error'
  error: Error
}

export interface DashboardAuthAuthenticated {
  status: 'authenticated'
  user: User
}

export type DashboardAuthState =
  | DashboardAuthLoading
  | DashboardAuthMissingHandler
  | DashboardAuthMissingApiKey
  | DashboardAuthRedirecting
  | DashboardAuthError
  | DashboardAuthAuthenticated

interface DashboardAuthCheck {
  type: 'check'
}

interface DashboardAuthSetupCloud {
  type: 'setupCloud'
}

export type DashboardAuthAction = DashboardAuthCheck | DashboardAuthSetupCloud

const authState = atom<DashboardAuthState>({status: 'loading'})

export const setUserRolesAtom = atom(null, (get, set, roles: Array<string>) => {
  const state = get(authAtom)
  if (state.status === 'authenticated')
    set(authState, {...state, user: {...state.user, roles}})
})

export const authAtom = Object.assign(
  atom(
    (get): DashboardAuthState => {
      if (!get(authRequiredAtom)) {
        const userData =
          typeof process !== 'undefined' &&
          (process.env.ALINEA_USER as string | undefined)
        return {
          status: 'authenticated',
          user: userData ? JSON.parse(userData) : localUser
        }
      }
      return get(authState)
    },
    async (get, set, action: DashboardAuthAction = {type: 'check'}) => {
      if (action.type === 'setupCloud') {
        const state = get(authState)
        if (state.status !== 'missingApiKey') return
        window.location.href = appendFrom(state.setupUrl)
        return
      }

      if (!get(authRequiredAtom)) return

      const client = get(clientAtom)
      if (!(client instanceof Client)) {
        set(authState, {
          status: 'error',
          error: new Error('Cannot authenticate with non http client')
        })
        return
      }

      set(authState, {status: 'loading'})
      try {
        const result = await client.authStatus()
        switch (result.type) {
          case AuthResultType.NeedsRefresh:
            set(authState, {
              status: 'error',
              error: new Error(
                'Authentication failure, please refresh the page'
              )
            })
            return
          case AuthResultType.Authenticated:
            set(
              clientAtom,
              client.authenticate(
                options => options,
                () => set(authAtom, {type: 'check'})
              )
            )
            set(authState, {status: 'authenticated', user: result.user})
            return
          case AuthResultType.UnAuthenticated:
            set(authState, {status: 'redirecting'})
            window.location.href = appendFrom(result.redirect)
            return
          case AuthResultType.MissingApiKey:
            set(authState, {
              status: 'missingApiKey',
              setupUrl: result.setupUrl
            })
            return
        }
      } catch {
        set(authState, {status: 'missingHandler'})
      }
    }
  ),
  {
    onMount(checkAuth: (action?: DashboardAuthAction) => void) {
      checkAuth({type: 'check'})
    }
  }
)

function appendFrom(url: string): string {
  const {location} = window
  const from = encodeURIComponent(
    `${location.protocol}//${location.host}${location.pathname}`
  )
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}from=${from}`
}
