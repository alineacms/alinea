import {atom} from 'jotai'
import {atomWithStorage} from 'jotai/utils'

export type ColorScheme = 'light' | 'dark' | undefined
export type Language = 'en' | undefined

export interface Preferences {
  scheme: ColorScheme
  workspace: string | undefined
  size: number
  language: Language
}

export const preferencesAtom = atomWithStorage(`@alinea/preferences`, {
  scheme: undefined,
  workspace: undefined,
  size: 16,
  language: undefined
} as Preferences)

export const schemePreferenceAtom = atom(
  get => get(preferencesAtom).scheme,
  (get, set, scheme: ColorScheme) => {
    set(preferencesAtom, {...get(preferencesAtom), scheme})
  }
)

export const toggleSchemePreferenceAtom = atom(null, (get, set) => {
  const scheme = get(schemePreferenceAtom)
  const isLight =
    scheme === undefined
      ? window.matchMedia('(prefers-color-scheme: light)').matches
      : scheme === 'light'
  const next = isLight ? 'dark' : 'light'
  set(schemePreferenceAtom, next)
})

export const workspacePreferenceAtom = atom(
  get => get(preferencesAtom).workspace,
  (get, set, workspace: string | undefined) => {
    set(preferencesAtom, {...get(preferencesAtom), workspace})
  }
)

export const sizePreferenceAtom = atom(
  get => get(preferencesAtom).size,
  (get, set, size: number) => {
    set(preferencesAtom, {...get(preferencesAtom), size})
  }
)

export const languagePreferenceAtom = atom(
  get => get(preferencesAtom).language,
  (get, set, language: Language) => {
    set(preferencesAtom, {...get(preferencesAtom), language})
  }
)
