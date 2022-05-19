import {
  ColorScheme,
  FontSize,
  Language,
  PreferencesProvider
} from './hook/UsePreferences'
import {HTMLProps, PropsWithChildren, useState} from 'react'

import css from './Viewport.module.scss'
import {fromModule} from './util/Styler'
import {parseToHsla} from 'color2k'
import {useContrastColor} from './hook/UseContrastColor'

const styles = fromModule(css)

type ViewportProps = PropsWithChildren<
  {
    color: string
    contain?: boolean
  } & HTMLProps<HTMLDivElement>
>

export function Viewport({children, color, contain, ...props}: ViewportProps) {
  const accentColor = color!
  const accentColorForeground = useContrastColor(accentColor)
  const persistenceId = `@alinea/ui/viewport`
  const preferences =
    typeof window !== 'undefined'
      ? JSON.parse(window.localStorage?.getItem(persistenceId) as any) ||
        undefined
      : undefined
  const [schemePreference, setSchemePreference] = useState<ColorScheme>(
    preferences?.scheme
  )
  const [workspacePreference, setWorkspacePreference] = useState<string>(
    preferences?.workspace
  )
  const [sizePreference, setSizePreference] = useState<FontSize>(
    preferences?.size
  )
  const [languagePreference, setLanguagePreference] = useState<Language>(
    preferences?.language
  )
  function toggleSchemePreference() {
    const isLight =
      schemePreference === undefined
        ? window.matchMedia('(prefers-color-scheme: light)').matches
        : schemePreference === 'light'
    const next = isLight ? 'dark' : 'light'
    setSchemePreference(next)
    window?.localStorage?.setItem(
      persistenceId,
      JSON.stringify({...preferences, scheme: next})
    )
  }
  function updateWorkspacePreference(workspace: string) {
    setWorkspacePreference(workspace)
    window?.localStorage?.setItem(
      persistenceId,
      JSON.stringify({...preferences, workspace: workspace})
    )
  }
  function updateSizePreference(size: FontSize) {
    setSizePreference(size)
    window?.localStorage?.setItem(
      persistenceId,
      JSON.stringify({...preferences, size: size})
    )
  }
  function updateLanguagePreference(lang: Language) {
    setLanguagePreference(lang)
    window?.localStorage?.setItem(
      persistenceId,
      JSON.stringify({...preferences, language: lang})
    )
  }
  const [hue] = parseToHsla(accentColor)
  return (
    <PreferencesProvider
      value={[
        {
          scheme: schemePreference,
          workspace: workspacePreference,
          size: sizePreference,
          language: languagePreference
        },
        toggleSchemePreference,
        updateWorkspacePreference,
        updateSizePreference,
        updateLanguagePreference
      ]}
    >
      <main
        style={
          {
            '--accent': accentColor,
            '--accent-foreground': accentColorForeground
            // '--hue': hue
          } as any
        }
        {...props}
        className={styles.root.mergeProps(props)(schemePreference, {contain})}
      >
        {children}
      </main>
    </PreferencesProvider>
  )
}
