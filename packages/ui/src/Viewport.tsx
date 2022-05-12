import {parseToHsla} from 'color2k'
import {HTMLProps, PropsWithChildren, useState} from 'react'
import {ColorSchemeProvider} from './hook/UseColorScheme'
import {useContrastColor} from './hook/UseContrastColor'
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
  //const {scheme} = useColorScheme()
  const persistenceId = `@alinea/ui/viewport`
  const [schemePreference, setSchemePreference] = useState<
    'light' | 'dark' | undefined
  >(
    typeof window !== 'undefined'
      ? (window.localStorage?.getItem(persistenceId) as any) || undefined
      : undefined
  )
  function toggleSchemePreference() {
    const isLight =
      schemePreference === undefined
        ? window.matchMedia('(prefers-color-scheme: light)').matches
        : schemePreference === 'light'
    const next = isLight ? 'dark' : 'light'
    setSchemePreference(next)
    window?.localStorage?.setItem(persistenceId, next)
  }
  const [hue] = parseToHsla(accentColor)
  return (
    <ColorSchemeProvider value={[schemePreference, toggleSchemePreference]}>
      <main
        style={
          {
            '--alinea-accent': accentColor,
            '--alinea-accent-foreground': accentColorForeground
            // '--alinea-hue': hue
          } as any
        }
        {...props}
        className={styles.root.mergeProps(props)(schemePreference, {contain})}
      >
        {children}
      </main>
    </ColorSchemeProvider>
  )
}
