import {parseToHsla} from 'color2k'
import {PropsWithChildren, useEffect, useLayoutEffect, useState} from 'react'
import {useContrastColor} from './hook/UseContrastColor'
import {ColorScheme, Language, PreferencesProvider} from './hook/UsePreferences'
import {fromModule} from './util/Styler'
import css from './Viewport.module.scss'

const styles = fromModule(css)

type ViewportProps = PropsWithChildren<{
  color: string
  contain?: boolean
  // Some UI frameworks insist on helping you by rendering components to the
  // body element directly. To style these we can apply our global styles
  // to the body instead. Don't use this if you're server side rendering.
  attachToBody?: boolean
}>

const useIsomorphicEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function Viewport({
  children,
  color,
  contain,
  attachToBody
}: ViewportProps) {
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
  const [sizePreference, setSizePreference] = useState<number>(
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
  function updateSizePreference(size: number) {
    document.documentElement.style.fontSize = `${size}px`
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
  const style: any = {
    '--alinea-accent': accentColor,
    '--alinea-accent-foreground': accentColorForeground
    // '--alinea-hue': hue
  }
  const className = styles.root(schemePreference)
  const styleString = Object.entries(style)
    .map(([key, value]) => {
      return `${key}: ${value}`
    })
    .join('; ')
  useIsomorphicEffect(() => {
    if (attachToBody) {
      document.body.className = className
      document.body.style.cssText = styleString
    }
  }, [styleString, className])
  const mainProps = attachToBody ? {} : {className, style}
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
        {...mainProps}
        className={styles.main.mergeProps(mainProps)({contain})}
      >
        {children}
      </main>
    </PreferencesProvider>
  )
}
