import {parseToHsla} from 'color2k'
import {HTMLProps, PropsWithChildren, useState} from 'react'
import {useContrastColor} from './hook/UseContrastColor'
import {PreferencesProvider} from './hook/UsePreferences'
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
  const [schemePreference, setSchemePreference] = useState<
    'light' | 'dark' | undefined
  >(
    typeof window !== 'undefined'
      ? (window.localStorage?.getItem(persistenceId) as any)?.scheme ||
          undefined
      : undefined
  )
  function toggleSchemePreference() {
    const prev =
      typeof window !== 'undefined'
        ? (window.localStorage?.getItem(persistenceId) as any) || undefined
        : undefined
    const isLight =
      schemePreference === undefined
        ? window.matchMedia('(prefers-color-scheme: light)').matches
        : schemePreference === 'light'
    const next = isLight ? 'dark' : 'light'
    setSchemePreference(next)
    window?.localStorage?.setItem(
      persistenceId,
      JSON.stringify({...prev, scheme: next})
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
        {scheme: schemePreference, size: undefined, language: undefined},
        toggleSchemePreference
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
