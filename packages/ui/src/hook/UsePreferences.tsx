import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useState
} from 'react'

export type ColorScheme = 'light' | 'dark' | undefined
export type Language = 'en' | undefined

export type Preferences = {
  scheme: ColorScheme
  workspace: string | undefined
  size: number
  language: Language
}

export type PreferencesState = Preferences & {
  toggleColorScheme(): void
  setWorkspace(workspace: string): void
  updateFontSize(size: number): void
  setLanguage(language: Language): void
}

const defaultSize = 16

const context = createContext<PreferencesState | undefined>(undefined)

export function usePreferences(): PreferencesState {
  return useContext(context)!
}

function usePreferencesState(): PreferencesState {
  const persistenceId = `@alinea/ui/viewport`
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try {
      return (
        JSON.parse(window.localStorage?.getItem(persistenceId) as any) || {}
      )
    } catch (e) {
      return {}
    }
  })
  const savePreferences = useCallback(
    (preferences: Preferences) => {
      setPreferences(preferences)
      try {
        window?.localStorage?.setItem(
          persistenceId,
          JSON.stringify(preferences)
        )
      } catch (e) {}
    },
    [setPreferences]
  )
  return {
    ...preferences,
    size: preferences.size || defaultSize,
    toggleColorScheme() {
      const isLight =
        preferences.scheme === undefined
          ? window.matchMedia('(prefers-color-scheme: light)').matches
          : preferences.scheme === 'light'
      const next = isLight ? 'dark' : 'light'
      savePreferences({...preferences, scheme: next})
    },
    setWorkspace(workspace) {
      savePreferences({...preferences, workspace})
    },
    updateFontSize(size) {
      savePreferences({...preferences, size})
    },
    setLanguage(language) {
      savePreferences({...preferences, language})
    }
  }
}

export function PreferencesProvider({children}: PropsWithChildren<{}>) {
  const state = usePreferencesState()
  return <context.Provider value={state}>{children}</context.Provider>
}
