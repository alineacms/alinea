import {AuthResultType} from '#/cloud/AuthResult.js'
import {Client} from '#/core/Client.js'
import type {LocalConnection} from '#/core/Connection.js'
import {Policy} from '#/core/Role.js'
import {localUser, type User} from '#/core/User.js'
import {atom} from 'jotai'
import {atomWithStorage, unwrap} from 'jotai/utils'
import type {SetStateAction} from 'react'
import {graphAtom, shaAtom} from './graph.js'
import type {RouteHistory} from './routing/history.js'
import {swr, requiredAtom, withPending} from './utils.js'
import {configAtom} from './config.js'

export interface DashboardOptions {
  alineaDev?: boolean
  history?: RouteHistory
  local?: boolean
}

export const clientAtom = requiredAtom<LocalConnection>('dashboard.client')
export const optionsAtom = atom<DashboardOptions>({})

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

const authRequiredAtom = atom((get): boolean => {
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

export const userAtom = swr(
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

export const updateUserRolesAtom = atom(
  null,
  async (get, set, roles: Array<string>) => {
    const user = await get(userAtom)
    if (!user) return
    set(userOverrideAtom, {...user, roles})
  }
)

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

const backendCapabilitiesResourceAtom = atom(async get => {
  const client = get(clientAtom)
  if (!client.capabilities)
    throw new Error('Backend capabilities are not available')
  return client.capabilities()
})

export const policyResourceAtom = atom(async get => {
  const user = await get(userAtom)
  if (!user?.roles) return Policy.ALLOW_NONE
  const db = get(graphAtom)
  get(shaAtom)
  const roles = get(configAtom).roles ?? {}
  return db.createPolicy(user.roles.filter(role => role in roles))
})

const policyStateAtom = withPending(policyResourceAtom)

export const policyAtom = atom(get => {
  const [, policy] = get(policyStateAtom)
  return policy ?? Policy.ALLOW_NONE
})

export const canManageMembersAtom = atom(async get => {
  const capabilities = await get(backendCapabilitiesResourceAtom)
  if (!capabilities.users) return false
  const policy = await get(policyResourceAtom)
  return policy.canManageMembers()
})

export type ThemeMode = 'system' | 'light' | 'dark'

const storageKey = 'alinea-dashboard-theme'
const themeStorageAtom = atomWithStorage<ThemeMode>(
  storageKey,
  'system',
  undefined
)
let enableTransitionsFrame: number | undefined

export const themeAtom = Object.assign(
  atom(
    get => get(themeStorageAtom),
    (get, set, next: SetStateAction<ThemeMode>) => {
      const current = get(themeStorageAtom)
      const theme = typeof next === 'function' ? next(current) : next
      set(themeStorageAtom, theme)
      applyTheme(theme)
    }
  ),
  {
    onMount(setTheme: (update: SetStateAction<ThemeMode>) => void) {
      setTheme(current => current)
    }
  }
)

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  suspendTransitions()
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = theme
}

function suspendTransitions() {
  if (typeof document === 'undefined') return
  const {body} = document
  if (!body) return
  body.dataset.disableTransition = 'true'
  void body.offsetWidth
  if (enableTransitionsFrame) cancelAnimationFrame(enableTransitionsFrame)
  enableTransitionsFrame = requestAnimationFrame(() => {
    enableTransitionsFrame = requestAnimationFrame(() => {
      body.removeAttribute('data-disable-transition')
      enableTransitionsFrame = undefined
    })
  })
}
