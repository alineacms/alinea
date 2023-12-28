'use client'

import {HStack, Stack, VStack} from 'alinea/ui/Stack'
import {IcOutlineDarkMode} from 'alinea/ui/icons/IcOutlineDarkMode'
import {IcOutlineLightMode} from 'alinea/ui/icons/IcOutlineLightMode'
import {IcSharpBrightnessMedium} from 'alinea/ui/icons/IcSharpBrightnessMedium'
import {fromModule} from 'alinea/ui/util/Styler'
import Link from 'next/link'
import css from './Footer.module.scss'
import {PageContainer, PageTheme} from './Page'
import {WebTypo} from './WebTypo'
import {Newsletter} from './engage/Newsletter'

const styles = fromModule(css)

export interface FooterProps {
  theme: PageTheme
  setTheme: (theme: PageTheme) => void
}

const themeIcons = {
  system: IcSharpBrightnessMedium,
  dark: IcOutlineDarkMode,
  light: IcOutlineLightMode
}

export function Footer() {
  const theme = 'system'
  const ThemeIcon = themeIcons[theme]
  function handleThemeToggle() {
    /*setTheme(
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'
    )*/
  }
  return (
    <footer className={styles.root()}>
      <PageContainer>
        <HStack wrap center gap={30} align="flex-start">
          <Stack.Left>
            <VStack gap={15}>
              <WebTypo.H4>Developer</WebTypo.H4>
              <VStack gap={10} as="nav">
                <div>
                  <Link href="/docs" className={styles.root.link()}>
                    Docs
                  </Link>
                </div>
                <div>
                  <Link href="/changelog" className={styles.root.link()}>
                    Changelog
                  </Link>
                </div>
                <div>
                  <Link href="/playground" className={styles.root.link()}>
                    Playground
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
          </Stack.Left>

          {/*<HStack
            center
            gap={8}
            as="button"
            type="button"
            onClick={handleThemeToggle}
            className={styles.root.theme()}
          >
            <ThemeIcon />
            <span>{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
          </HStack>*/}

          <Newsletter />
        </HStack>
      </PageContainer>
    </footer>
  )
}
