import {createContext, useContext} from 'react'

export type ColorScheme = 'light' | 'dark' | undefined
export type Language = 'en' | undefined

export type Preferences = {
  scheme: ColorScheme
  workspace: string | undefined
  size: number
  language: Language
}

export type PreferencesContext = [
  Preferences,
  () => void,
  (workspace: string) => void,
  (size: number) => void,
  (lang: Language) => void
]

const context = createContext<PreferencesContext | undefined>(undefined)

export function usePreferences() {
  return useContext(context)!
}

export const PreferencesProvider = context.Provider
