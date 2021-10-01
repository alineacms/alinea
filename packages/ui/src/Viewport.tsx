import {PropsWithChildren, useState} from 'react'
import {useColorScheme} from 'use-color-scheme'
import {ColorScheme, ColorSchemeProvider} from './hook/UseColorScheme'
import {useContrastColor} from './hook/UseContrastColor'
import {fromModule} from './util/styler'
import css from './Viewport.module.scss'

const styles = fromModule(css)

type ViewportProps = PropsWithChildren<{
  color: string
}>

export function Viewport({children, color}: ViewportProps) {
  const accentColor = color!
  const accentColorForeground = useContrastColor(accentColor)
  const {scheme} = useColorScheme()
  const [schemePreference, setSchemePreference] = useState<
    'light' | 'dark' | undefined
  >(undefined)
  const usedScheme: ColorScheme =
    schemePreference || (scheme !== 'none' ? (scheme as ColorScheme) : 'dark')
  return (
    <ColorSchemeProvider value={[usedScheme, setSchemePreference]}>
      <main
        style={
          {
            '--accent': accentColor,
            '--accent-foreground': accentColorForeground
          } as any
        }
        className={styles.root.is(usedScheme)()}
      >
        {children}
      </main>
    </ColorSchemeProvider>
  )
}
