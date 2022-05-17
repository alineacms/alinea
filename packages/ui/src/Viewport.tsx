import {parseToHsla} from 'color2k'
import {HTMLProps, PropsWithChildren, useState} from 'react'
import {useContrastColor} from './hook/UseContrastColor'
import {PreferencesProvider} from './hook/UsePreferences'
import {fromModule} from './util/Styler'
import css from './Viewport.module.scss'

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
  return (
    <PreferencesProvider
      value={[
        {scheme: schemePreference, size: undefined, language: undefined},
        toggleSchemePreference
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
