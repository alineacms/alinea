import {fromModule, HStack, LogoShape, Stack, TextLabel} from '@alinea/ui'
import {MdiGithub} from '@alinea/ui/icons/MdiGithub'
import {MdiTwitterCircle} from '@alinea/ui/icons/MdiTwitterCircle'
import {MiLayers} from '@alinea/ui/icons/MiLayers'
import {Modal} from '@alinea/ui/Modal'
import Link from 'next/link'
import {useState} from 'react'
import {Logo} from './branding/Logo'
import css from './Header.module.scss'
import {HeaderProps} from './Header.query'

const styles = fromModule(css)

export function Header({links}: HeaderProps) {
  return (
    <header className={styles.root()}>
      <HStack center gap={36}>
        <Link href="/">
          <a className={styles.root.logo()}>
            <HStack center gap={9}>
              <LogoShape foreground="white" background="#4a63e7">
                <MiLayers />
              </LogoShape>
              <Logo className={styles.root.logo.text()} />
            </HStack>
          </a>
        </Link>
        <HStack as="nav" center gap={30} className={styles.root.nav()}>
          {links.map(link => {
            switch (link.type) {
              case 'entry':
                return (
                  <Link key={link.id} href={link.url}>
                    <a className={styles.root.link()}>
                      <TextLabel label={link.title} />
                    </a>
                  </Link>
                )
              default:
                return null
            }
          })}
          <Link href="/types/alinea">
            <a className={styles.root.link()}>API</a>
          </Link>
          <Link href="/changelog">
            <a className={styles.root.link()} href="/changelog">
              Changelog
            </a>
          </Link>
          <a className={styles.root.link()} href="/demo" target="_blank">
            Demo
          </a>
        </HStack>
        <Stack.Right>
          <HStack gap={16} center>
            <a
              className={styles.root.social()}
              href="https://github.com/alineacms/alinea"
              target="_blank"
            >
              <MdiGithub className={styles.root.social.icon()} />
            </a>
            <a
              className={styles.root.social()}
              href="https://twitter.com/alineacms"
              target="_blank"
            >
              <MdiTwitterCircle className={styles.root.social.icon()} />
            </a>
            <Hamburger links={links} />
          </HStack>
        </Stack.Right>
      </HStack>
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

const Hamburger: React.FC<HeaderProps> = ({links}) => {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <button className={styles.hamburger()} onClick={() => setIsOpen(true)}>
        <span className={styles.hamburger.bar()} />
        <span className={styles.hamburger.bar()} />
        <span className={styles.hamburger.bar()} />
      </button>
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className={styles.hamburger.mobilemenu()}
      >
        <Mobilemenu links={links} onClose={() => setIsOpen(false)} />
      </Modal>
    </>
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
      gap={30}
      className={styles.mobilemenu()}
    >
      {links.map(link => {
        switch (link.type) {
          case 'entry':
            return (
              <Link key={link.id} href={link.url}>
                <a className={styles.mobilemenu.link()} onClick={onClose}>
                  <TextLabel label={link.title} />
                </a>
              </Link>
            )
          default:
            return null
        }
      })}
      <Link href="/types/alinea">
        <a className={styles.mobilemenu.link()} onClick={onClose}>
          API
        </a>
      </Link>
      <Link href="/changelog">
        <a className={styles.mobilemenu.link()} onClick={onClose}>
          Changelog
        </a>
      </Link>
      <a
        className={styles.mobilemenu.link()}
        href="/demo"
        target="_blank"
        onClick={onClose}
      >
        Demo
      </a>
    </HStack>
  )
}
