import {AuthResultType} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import {localUser, type User} from '#/core/User.js'
import {atom} from 'jotai'
import {unwrap} from 'jotai/utils'
import {keepPrevious} from './AtomUtils.js'
import {clientAtom, optionsAtom} from './CoreAtoms.js'

export interface AuthLoading {
  status: 'loading'
}

export interface AuthMissingHandler {
  status: 'missingHandler'
}

export interface AuthMissingApiKey {
  status: 'missingApiKey'
  setupUrl: string
}

export interface AuthRedirecting {
  status: 'redirecting'
}

export interface AuthError {
  status: 'error'
  error: Error
}

export interface Authenticated {
  status: 'authenticated'
}

export type AuthState =
  | AuthLoading
  | AuthMissingHandler
  | AuthMissingApiKey
  | AuthRedirecting
  | AuthError
  | Authenticated

export interface AuthCheck {
  type: 'check'
}

export interface AuthSetupCloud {
  type: 'setupCloud'
}

export type AuthAction = AuthCheck | AuthSetupCloud

interface LogoutConnection {
  logout(): Promise<void>
}

export function appendReturnUrl(url: string): string {
  const {location} = window
  const from = encodeURIComponent(
    `${location.protocol}//${location.host}${location.pathname}`
  )
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}from=${from}`
}

const userOverrideAtom = atom<User | null | undefined>()
const authStateAtom = atom<AuthState>({status: 'loading'})

export const authRequiredAtom = atom((get): boolean => {
  const forceAuth =
    typeof process !== 'undefined' && process.env.ALINEA_FORCE_AUTH
  if (forceAuth) return true
  const {alineaDev, local} = get(optionsAtom)
  return !(alineaDev || local)
})

export const isLocalAtom = atom(get => {
  const {alineaDev, local} = get(optionsAtom)
  return alineaDev || local
})

export const authAtom = Object.assign(
  atom(
    get => {
      if (!get(authRequiredAtom)) {
        return {status: 'authenticated'} satisfies AuthState
      }
      return get(authStateAtom)
    },
    async (get, set, action: AuthAction = {type: 'check'}) => {
      if (action.type === 'setupCloud') {
        const state = get(authStateAtom)
        if (state.status !== 'missingApiKey') return
        window.location.href = appendReturnUrl(state.setupUrl)
        return
      }

      if (!get(authRequiredAtom)) {
        set(authStateAtom, {status: 'authenticated'})
        return
      }

      const client = get(clientAtom)
      if (!(client instanceof Client)) {
        set(authStateAtom, {
          status: 'error',
          error: new Error('Cannot authenticate with non http client')
        })
        return
      }

      set(authStateAtom, {status: 'loading'})
      try {
        const result = await client.authStatus()
        switch (result.type) {
          case AuthResultType.NeedsRefresh:
            set(authStateAtom, {
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
                () => {
                  set(userOverrideAtom, null)
                  set(authStateAtom, {status: 'loading'})
                  set(authAtom, {type: 'check'})
                }
              )
            )
            set(userOverrideAtom, result.user)
            set(authStateAtom, {status: 'authenticated'})
            return
          case AuthResultType.UnAuthenticated:
            set(authStateAtom, {status: 'redirecting'})
            window.location.href = appendReturnUrl(result.redirect)
            return
          case AuthResultType.MissingApiKey:
            set(authStateAtom, {
              status: 'missingApiKey',
              setupUrl: result.setupUrl
            })
            return
        }
      } catch {
        set(authStateAtom, {status: 'missingHandler'})
      }
    }
  ),
  {
    onMount(checkAuth: (action?: AuthAction) => void) {
      checkAuth({type: 'check'})
    }
  }
)

export const userAtom = keepPrevious(
  atom(async get => {
    const override = get(userOverrideAtom)
    if (override !== undefined) return override
    if (!get(authRequiredAtom)) {
      const userData =
        typeof process !== 'undefined' &&
        (process.env.ALINEA_USER as string | undefined)
      if (!userData) return localUser
      return JSON.parse(userData) as User
    }
    return get(clientAtom).user()
  })
)

export const currentUserAtom = unwrap(userAtom)

export const setUserRolesAtom = atom(
  null,
  async (get, set, roles: Array<string>) => {
    const user = await get(userAtom)
    if (!user) return
    set(userOverrideAtom, {...user, roles})
  }
)

export const authenticateAtom = atom(null, (get, set, user: User) => {
  const client = get(clientAtom)
  if (client instanceof Client) {
    set(
      clientAtom,
      client.authenticate(
        options => options,
        () => {
          set(userOverrideAtom, null)
          set(authStateAtom, {status: 'loading'})
          set(authAtom, {type: 'check'})
        }
      )
    )
  }
  set(userOverrideAtom, user)
})

export const logoutAtom = atom(null, async (get, set) => {
  const client = get(clientAtom)
  const logout = (client as Partial<LogoutConnection>).logout
  if (typeof logout === 'function') await logout.call(client)
  set(userOverrideAtom, null)
  if (get(authRequiredAtom)) await set(authAtom, {type: 'check'})
})

export const canLogoutAtom = atom(get => {
  if (!get(authRequiredAtom)) return false
  const client = get(clientAtom)
  return typeof (client as Partial<LogoutConnection>).logout === 'function'
})
