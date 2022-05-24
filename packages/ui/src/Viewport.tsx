import {parseToHsla} from 'color2k'
import {PropsWithChildren, useEffect, useLayoutEffect, useState} from 'react'
import {useContrastColor} from './hook/UseContrastColor'
import {Language, Preferences, PreferencesProvider} from './hook/UsePreferences'
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
  const [preferences, setPreferences] = useState<Preferences>(
    typeof window !== 'undefined'
      ? JSON.parse(window.localStorage?.getItem(persistenceId) as any) ||
          undefined
      : undefined
  )
  const {scheme, size, workspace, language} = preferences
  useEffect(() => {
    if (!size) return
    document.documentElement.style.fontSize = `${size}px`
  }, [size])

  function toggleSchemePreference() {
    const isLight =
      scheme === undefined
        ? window.matchMedia('(prefers-color-scheme: light)').matches
        : scheme === 'light'
    const next = isLight ? 'dark' : 'light'
    setPreferences({...preferences, scheme: next})
    window?.localStorage?.setItem(
      persistenceId,
      JSON.stringify({...preferences, scheme: next})
    )
  }
  function updateWorkspacePreference(workspace: string) {
    setPreferences({...preferences, workspace: workspace})
    window?.localStorage?.setItem(
      persistenceId,
      JSON.stringify({...preferences, workspace: workspace})
    )
  }
  function updateSizePreference(size: number) {
    setPreferences({...preferences, size: size})
    window?.localStorage?.setItem(
      persistenceId,
      JSON.stringify({...preferences, size: size})
    )
  }
  function updateLanguagePreference(lang: Language) {
    setPreferences({...preferences, language: lang})
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
  const className = styles.root(scheme)
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
          scheme: scheme,
          workspace: workspace,
          size: size,
          language: language
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
