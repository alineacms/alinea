import {fromModule, HStack, Stack, Styler, VStack} from '@alinea/ui'
import {IcRoundClose} from '@alinea/ui/icons/IcRoundClose'
import {IcRoundHamburger} from '@alinea/ui/icons/IcRoundHamburger'
import {MdiGithub} from '@alinea/ui/icons/MdiGithub'
import {MdiTwitterCircle} from '@alinea/ui/icons/MdiTwitterCircle'
import Link from 'next/link'
import {MouseEvent, useState} from 'react'
import AnimateHeight from 'react-animate-height'
import {Logo} from './branding/Logo'
import css from './Header.module.scss'
import {HeaderProps} from './Header.server'

const styles = fromModule(css)

type LinksProps = {
  links: HeaderProps['links']
  style: Styler
}

function Links({links, style}: LinksProps) {
  return (
    <>
      {links.map(link => {
        switch (link.type) {
          case 'entry':
            return (
              <Link href={link.url} key={link.id}>
                <a className={style()}>{link.label}</a>
              </Link>
            )
          default:
            return null
        }
      })}
      <Link href="/types/alinea">
        <a className={style()}>API</a>
      </Link>
      <Link href="/changelog">
        <a className={style()}>Changelog</a>
      </Link>
      <a href="/demo" target="_blank" className={style()}>
        Demo
      </a>
    </>
  )
}

export function Header({links}: HeaderProps) {
  const [openMobilemenu, setOpenMobilemenu] = useState<boolean>(false)

  return (
    <header className={styles.root()}>
      <HStack center gap={36} className={styles.root.top()}>
        <Link href="/">
          <a className={styles.root.logo()}>
            <Logo />
          </a>
        </Link>
        <HStack as="nav" center gap={30} className={styles.root.nav()}>
          <Links links={links} style={styles.root.nav.link} />
        </HStack>
        <Stack.Right>
          <HStack gap={16} center>
            <a
              href="https://github.com/alineacms/alinea"
              target="_blank"
              className={styles.root.social()}
            >
              <MdiGithub className={styles.root.social.icon()} />
            </a>
            <a
              href="https://twitter.com/alineacms"
              target="_blank"
              className={styles.root.social()}
            >
              <MdiTwitterCircle className={styles.root.social.icon()} />
            </a>
            <button
              onClick={() => setOpenMobilemenu(!openMobilemenu)}
              className={styles.root.hamburger()}
            >
              {openMobilemenu ? <IcRoundClose /> : <IcRoundHamburger />}
            </button>
          </HStack>
        </Stack.Right>
      </HStack>
      <AnimateHeight height={openMobilemenu ? 'auto' : 0} duration={200}>
        <VStack
          as="nav"
          center
          gap={20}
          className={styles.mobilemenu()}
          onClick={(e: MouseEvent<HTMLDivElement>) => {
            if (e.currentTarget.nodeName === 'A') setOpenMobilemenu(false)
          }}
        >
          <Links links={links} style={styles.mobilemenu.link} />
        </VStack>
      </AnimateHeight>
      <svg
        viewBox="0 0 36 18"
        preserveAspectRatio="none"
        className={styles.root.bg()}
      >
        <path d="M18 0C25.8884 0 29.9402 0.340637 32.8088 3.19123C35.6773 6.05976 36 10.1116 36 18V0H18Z" />
        <path d="M0 18C0 10.1116 0.340637 6.05976 3.19123 3.19123C6.05976 0.340637 10.1116 0 18 0H0V18Z" />
      </svg>
    </header>
  )
}
