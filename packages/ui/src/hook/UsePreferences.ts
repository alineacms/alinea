import {createContext, useContext} from 'react'

export type Preferences = {
  scheme: 'light' | 'dark' | undefined
  size: 'small' | 'medium' | 'large' | undefined
  language: 'en' | undefined
}

export type PreferencesContext = [Preferences, () => void]

const context = createContext<PreferencesContext | undefined>(undefined)

export function usePreferences() {
  return useContext(context)!
}

export const PreferencesProvider = context.Provider
