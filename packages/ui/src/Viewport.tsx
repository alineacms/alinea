import {parseToHsla} from 'color2k'
import {
  createContext,
  HTMLProps,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
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

const ViewportContext = createContext<HTMLDivElement | null>(null)

export function useViewport() {
  return useContext(ViewportContext)
}

export function Viewport({children, color, contain, ...props}: ViewportProps) {
  const accentColor = color!
  const accentColorForeground = useContrastColor(accentColor)
  const [modalContainer, setModalContainer] = useState<HTMLDivElement | null>(
    null
  )
  const viewportRef = useRef<HTMLDivElement>(null)
  //const {scheme} = useColorScheme()

  useEffect(() => {
    setModalContainer(viewportRef?.current)
  }, [])

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
            '--accent': accentColor,
            '--accent-foreground': accentColorForeground
            // '--hue': hue
          } as any
        }
        {...props}
        className={styles.root.mergeProps(props)(schemePreference, {contain})}
        ref={viewportRef}
      >
        <ViewportContext.Provider value={modalContainer}>
          {children}
        </ViewportContext.Provider>
      </main>
    </ColorSchemeProvider>
  )
}
