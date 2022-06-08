import {fromModule, HStack, Stack, TextLabel} from '@alinea/ui'
import {IcRoundClose} from '@alinea/ui/icons/IcRoundClose'
import {IcRoundHamburger} from '@alinea/ui/icons/IcRoundHamburger'
import {MdiGithub} from '@alinea/ui/icons/MdiGithub'
import {MdiTwitterCircle} from '@alinea/ui/icons/MdiTwitterCircle'
import Link from 'next/link'
import {useState} from 'react'
import AnimateHeight from 'react-animate-height'
import {Logo} from './branding/Logo'
import css from './Header.module.scss'
import {HeaderProps} from './Header.server'

const styles = fromModule(css)

export function Header({links}: HeaderProps) {
  const [openMobilemenu, setOpenMobilemenu] = useState<boolean>(false)

  return (
    <header className={styles.root()}>
      <HStack center gap={36} className={styles.root.top()}>
        <Link href="/">
          <a className={styles.root.logo()}>
            <HStack center gap={9}>
              <Logo className={styles.root.logo.text()} />
            </HStack>
          </a>
        </Link>
        <HStack as="nav" center gap={30} className={styles.root.nav()}>
          {links.map(link => {
            switch (link.type) {
              case 'entry':
                return (
                  <Link href={link.url} key={link.id}>
                    <a className={styles.root.nav.link()}>
                      <TextLabel label={link.title} />
                    </a>
                  </Link>
                )
              default:
                return null
            }
          })}
          <Link href="/types/alinea">
            <a className={styles.root.nav.link()}>API</a>
          </Link>
          <Link href="/changelog">
            <a className={styles.root.nav.link()}>Changelog</a>
          </Link>
          <a href="/demo" target="_blank" className={styles.root.nav.link()}>
            Demo
          </a>
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
      <AnimateHeight height={openMobilemenu ? 'auto' : 0}>
        <Mobilemenu links={links} onClose={() => setOpenMobilemenu(false)} />
      </AnimateHeight>
    </header>
  )
}

const Mobilemenu: React.FC<HeaderProps & {onClose: () => void}> = ({
  links,
  onClose
}) => {
  return (
    <HStack
      as="nav"
      center
      direction="column"
      align="center"
      justify="center"
      gap={20}
      className={styles.mobilemenu()}
    >
      {links.map(link => {
        switch (link.type) {
          case 'entry':
            return (
              <Link href={link.url} key={link.id}>
                <a onClick={onClose} className={styles.mobilemenu.link()}>
                  <TextLabel label={link.title} />
                </a>
              </Link>
            )
          default:
            return null
        }
      })}
      <Link href="/types/alinea">
        <a onClick={onClose} className={styles.mobilemenu.link()}>
          API
        </a>
      </Link>
      <Link href="/changelog">
        <a onClick={onClose} className={styles.mobilemenu.link()}>
          Changelog
        </a>
      </Link>
      <a
        href="/demo"
        target="_blank"
        onClick={onClose}
        className={styles.mobilemenu.link()}
      >
        Demo
      </a>
    </HStack>
  )
}
