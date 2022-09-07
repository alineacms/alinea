import {fromModule, HStack, VStack} from '@alinea/ui'
import {IcOutlineDarkMode} from '@alinea/ui/icons/IcOutlineDarkMode'
import {IcOutlineLightMode} from '@alinea/ui/icons/IcOutlineLightMode'
import {IcSharpBrightnessMedium} from '@alinea/ui/icons/IcSharpBrightnessMedium'
import Link from 'next/link'
import css from './Footer.module.scss'
import {Layout} from './Layout'
import {LayoutProps} from './Layout.server'
import {WebTypo} from './WebTypo'

const styles = fromModule(css)

export type FooterProps = {
  footer: LayoutProps['footer']
  theme: Layout.Theme
  setTheme: (theme: Layout.Theme) => void
}

const themeIcons = {
  system: IcSharpBrightnessMedium,
  dark: IcOutlineDarkMode,
  light: IcOutlineLightMode
}

export function Footer({footer, theme, setTheme}: FooterProps) {
  const ThemeIcon = themeIcons[theme]
  function handleThemeToggle() {
    setTheme(
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    )
  }
  return (
    <footer className={styles.root()}>
      <Layout.Container>
        <HStack align="flex-start">
          <VStack gap={15}>
            <WebTypo.H4>Developer</WebTypo.H4>
            <VStack gap={10} as="nav">
              <div>
                <Link href="/docs/overview/intro">
                  <a className={styles.root.link()}>Docs</a>
                </Link>
              </div>
              <div>
                <Link href="/changelog">
                  <a className={styles.root.link()}>Changelog</a>
                </Link>
              </div>
              <div>
                <Link href="/types/alinea">
                  <a className={styles.root.link()}>API</a>
                </Link>
              </div>
              <div>
                <Link href="/playground">
                  <a className={styles.root.link()}>Playground</a>
                </Link>
              </div>
              <div>
                <a
                  className={styles.root.link()}
                  href="https://github.com/alineacms/alinea"
                  target="_blank"
                >
                  Source
                </a>
              </div>
            </VStack>
          </VStack>
          {/*footer?.map(section => {
            return (
              <div key={section.id}>
                <WebTypo.H4>{section.label}</WebTypo.H4>
                <nav>
                  {section.links.map(link => {
                    return (
                      <Link key={link.id} href={link.url}>
                        <a key={link.id}>{link.label}</a>
                      </Link>
                    )
                  })}
                </nav>
              </div>
            )
          })*/}

          <HStack
            style={{marginTop: 'auto'}}
            center
            gap={8}
            as="button"
            type="button"
            onClick={handleThemeToggle}
            className={styles.root.theme()}
          >
            <ThemeIcon />
            <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          </HStack>
        </HStack>
      </Layout.Container>
    </footer>
  )
}
