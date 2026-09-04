import type {LocalConnection} from '#/core/Connection.js'
import {atom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import type {SetStateAction} from 'react'
import {authAtom, authRequiredAtom} from './auth.js'
import {clientAtom} from './core.js'

export type DashboardTheme = 'system' | 'light' | 'dark'

interface LogoutConnection {
  logout(): Promise<void>
}

const dashboardThemeStorageKey = 'alinea-dashboard-theme'

const themeStorageAtom = atomWithStorage<DashboardTheme>(
  dashboardThemeStorageKey,
  'system',
  undefined
)

const mobileMediaQuery = '(max-width: 768px)'

export const dashboardMobileAtom = atom(
  typeof window !== 'undefined' &&
    (window.matchMedia?.(mobileMediaQuery).matches ?? false)
)

dashboardMobileAtom.onMount = setMobile => {
  const media = window.matchMedia?.(mobileMediaQuery)
  if (!media) return
  const update = () => setMobile(media.matches)
  update()
  media.addEventListener('change', update)
  return () => media.removeEventListener('change', update)
}

export const navigationSidebarWidthAtom = atom(320)
export const entrySidebarWidthAtom = atom(320)

export const entrySidebarOpenAtom = atom(
  typeof window === 'undefined' ||
    !window.matchMedia?.('(max-width: 768px)').matches
)

export const themeAtom = Object.assign(
  atom(
    get => get(themeStorageAtom),
    (get, set, update: SetStateAction<DashboardTheme>) => {
      const current = get(themeStorageAtom)
      const next = typeof update === 'function' ? update(current) : update
      set(themeStorageAtom, next)
      applyDashboardTheme(next)
    }
  ),
  {
    onMount(setTheme: (update: SetStateAction<DashboardTheme>) => void) {
      setTheme(current => current)
    }
  }
)

export const canLogoutAtom = atom(get => {
  if (!get(authRequiredAtom)) return false
  const client = get(clientAtom) as LocalConnection & Partial<LogoutConnection>
  return typeof client.logout === 'function'
})

export const logoutAtom = atom(null, async (get, set) => {
  const client = get(clientAtom) as LocalConnection & Partial<LogoutConnection>
  if (client.logout) await client.logout()
  await set(authAtom, {type: 'check'})
})

let enableThemeTransitionsFrame: number | undefined

function applyDashboardTheme(theme: DashboardTheme) {
  if (typeof document === 'undefined') return
  const {body, documentElement} = document
  if (body) {
    body.dataset.disableTransition = 'true'
    void body.offsetWidth
    if (enableThemeTransitionsFrame)
      cancelAnimationFrame(enableThemeTransitionsFrame)
    enableThemeTransitionsFrame = requestAnimationFrame(() => {
      enableThemeTransitionsFrame = requestAnimationFrame(() => {
        body.removeAttribute('data-disable-transition')
        enableThemeTransitionsFrame = undefined
      })
    })
  }
  if (theme === 'system') documentElement.removeAttribute('data-theme')
  else documentElement.dataset.theme = theme
}
