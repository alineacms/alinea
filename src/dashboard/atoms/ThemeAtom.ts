import {atom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'
import type {SetStateAction} from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

const storageKey = 'alinea-dashboard-theme'
let enableTransitionsFrame: number | undefined

export function createThemeAtom() {
  const storage = atomWithStorage<ThemeMode>(storageKey, 'system', undefined)
  return Object.assign(
    atom(
      get => get(storage),
      (get, set, next: SetStateAction<ThemeMode>) => {
        const current = get(storage)
        const theme = typeof next === 'function' ? next(current) : next
        set(storage, theme)
        applyTheme(theme)
      }
    ),
    {
      onMount(setTheme: (update: SetStateAction<ThemeMode>) => void) {
        setTheme(current => current)
      }
    }
  )
}

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
