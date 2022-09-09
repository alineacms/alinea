import {fromModule, HStack, Stack, Styler} from '@alinea/ui'
import {IcRoundClose} from '@alinea/ui/icons/IcRoundClose'
import {IcRoundHamburger} from '@alinea/ui/icons/IcRoundHamburger'
import {MdiGithub} from '@alinea/ui/icons/MdiGithub'
import {MdiTwitterCircle} from '@alinea/ui/icons/MdiTwitterCircle'
import Link from 'next/link'
import {useRouter} from 'next/router'
import {useEffect, useMemo, useState} from 'react'
import {Logo} from './branding/Logo'
import css from './Header.module.scss'
import {Layout} from './Layout'
import {Nav, NavTree, useNavTree} from './NavTree'

const styles = fromModule(css)

type LinksProps = {
  links: HeaderProps['links']
  style: Styler
}

function Links({links, style}: LinksProps) {
  const router = useRouter()
  return (
    <>
      {links?.map(link => {
        switch (link.type) {
          case 'entry':
            return (
              <Link href={link.url} key={link.id}>
                <a
                  className={style({
                    active: router.asPath.startsWith(link.active || link.url)
                  })}
                >
                  {link.label}
                </a>
              </Link>
            )
          default:
            return null
        }
      })}
      <Link href="/changelog">
        <a className={style({active: router.asPath.startsWith('/changelog')})}>
          Changelog
        </a>
      </Link>
      <a href="https://demo.alinea.sh" target="_blank" className={style()}>
        Demo
      </a>
    </>
  )
}

type Link = {
  id: string
  type: string
  url: string
  active?: string
  label: string
}

export type HeaderProps = {
  links?: Array<Link>
  menu: Nav
  transparent: boolean
}

export function Header({links, menu, transparent}: HeaderProps) {
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false)
  function toggleMobileMenu() {
    setIsMobileOpen(!isMobileOpen)
  }
  const mobileTree: Nav = useMemo(() => {
    return [
      {id: 'home', url: '/', title: 'Home'},
      {id: 'roadmap', url: '/roadmap', title: 'Roadmap'},
      {id: 'blog', url: '/blog', title: 'Blog'},
      ...menu.map(page => {
        if (page.parent) return page
        return {...page, parent: 'docs'}
      }),
      {id: 'docs', url: '/docs', title: 'Docs'},
      {id: 'developer', title: 'Developer'},
      {
        parent: 'developer',
        id: 'changelog',
        url: '/changelog',
        title: 'Changelog'
      },
      {parent: 'developer', id: 'api', url: '/types/alinea', title: 'API'},
      {
        parent: 'developer',
        id: 'playground',
        url: '/playground',
        title: 'Playground'
      }
    ]
  }, [links, menu])
  const nav = useNavTree(mobileTree)
  useEffect(() => {
    if (isMobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
  }, [isMobileOpen])
  useEffect(() => {
    if (isMobileOpen) setIsMobileOpen(false)
  }, [router.asPath])
  return (
    <>
      <header className={styles.root({transparent})}>
        <Layout.Container style={{height: '100%'}}>
          <Menu
            links={links}
            isMobileOpen={isMobileOpen}
            toggleMobileMenu={toggleMobileMenu}
          />
        </Layout.Container>
      </header>
      <div className={styles.mobilemenu({open: isMobileOpen})}>
        <div className={styles.mobilemenu.container()}>
          <Layout.Container className={styles.mobilemenu.top()}>
            <Menu
              links={links}
              isMobileOpen={isMobileOpen}
              toggleMobileMenu={toggleMobileMenu}
            />
          </Layout.Container>
          <div className={styles.mobilemenu.nav()}>
            <NavTree nav={nav} />
          </div>
        </div>
      </div>
    </>
  )
}

interface MenuProps {
  links?: Array<Link>
  isMobileOpen: boolean
  toggleMobileMenu: () => void
}

function Menu({links, isMobileOpen, toggleMobileMenu}: MenuProps) {
  return (
    <HStack center gap={36} className={styles.root.inner()}>
      <Link href="/">
        <a className={styles.root.logo()}>
          <Logo />
        </a>
      </Link>
      <Stack.Center>
        <HStack as="nav" center className={styles.root.nav()}>
          <Links links={links} style={styles.root.nav.link} />
        </HStack>
      </Stack.Center>
      <HStack gap={16} center>
        {/*<a
          href="https://www.npmjs.com/package/alinea"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            style={{display: 'block'}}
            src="https://img.shields.io/npm/v/alinea.svg?style=flat-square"
          />
        </a>*/}
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
        <button onClick={toggleMobileMenu} className={styles.root.hamburger()}>
          {isMobileOpen ? <IcRoundClose /> : <IcRoundHamburger />}
        </button>
      </HStack>
    </HStack>
  )
}
