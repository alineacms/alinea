import {cms} from '@/cms'
import {EntryReference, UrlReference} from 'alinea'
import {HStack, Stack, Styler, fromModule} from 'alinea/ui'
import {MdiGithub} from 'alinea/ui/icons/MdiGithub'
import {MdiTwitterCircle} from 'alinea/ui/icons/MdiTwitterCircle'
import Link from 'next/link'
import {Home} from '../schema/Home'
import css from './Header.module.scss'
import {LayoutContainer} from './Layout'
import {Logo} from './branding/Logo'

const styles = fromModule(css)

export type HeaderLink =
  | (EntryReference & {
      label: string
      active: string
    })
  | (UrlReference & {
      label: string
      active: string
    })

export async function Header() {
  const links = await cms.get(Home().select(Home.links))
  return (
    <>
      <header className={styles.root()}>
        <LayoutContainer style={{height: '100%'}}>
          <Menu links={links} />
        </LayoutContainer>
      </header>
      <div className={styles.mobilemenu()}>
        <div className={styles.mobilemenu.container()}>
          <LayoutContainer className={styles.mobilemenu.top()}>
            hello mobile
          </LayoutContainer>
          <div className={styles.mobilemenu.nav()}>nav tree</div>
        </div>
      </div>
    </>
  )
}

interface MenuProps {
  links: Array<HeaderLink>
}

function Menu({links}: MenuProps) {
  return (
    <HStack center gap={36} className={styles.root.inner()}>
      <Link href="/" className={styles.root.logo()}>
        <Logo />
      </Link>
      <Stack.Center>
        <HStack as="nav" center className={styles.root.nav()}>
          <HeaderLinks links={links} style={styles.root.nav.link} />
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

        {/*<a
          href="/blog/introducing-alinea"
          className={styles.root.nav.link('intro')}
        >
          Introduction 🚀
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
        {/*<button onClick={toggleMobileMenu} className={styles.root.hamburger()}>
          {isMobileOpen ? <IcRoundClose /> : <IcRoundHamburger />}
        </button>*/}
      </HStack>
    </HStack>
  )
}

interface HeaderLinksProps {
  links: Array<HeaderLink>
  style: Styler
}

function HeaderLinks({links, style}: HeaderLinksProps) {
  return (
    <>
      {links?.map(link => {
        switch (link.type) {
          case 'entry':
            return (
              <Link
                href={link.url}
                key={link.id}
                className={style({
                  //active: pathname.startsWith(link.active || link.url)
                })}
              >
                {link.label}
              </Link>
            )
          default:
            return null
        }
      })}
      <Link
        href="/changelog"
        className={style({
          //active: pathname.startsWith('/changelog')
        })}
      >
        Changelog
      </Link>
      <a href="https://demo.alinea.sh" target="_blank" className={style()}>
        Demo
      </a>
    </>
  )
}
