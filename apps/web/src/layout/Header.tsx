import {cms} from '@/cms'
import {EntryReference, UrlReference} from 'alinea'
import {Entry} from 'alinea/core'
import {HStack, Stack, Styler, fromModule} from 'alinea/ui'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundHamburger} from 'alinea/ui/icons/IcRoundHamburger'
import {MdiGithub} from 'alinea/ui/icons/MdiGithub'
import {MdiTwitterCircle} from 'alinea/ui/icons/MdiTwitterCircle'
import {Link} from '../nav/Link'
import {NavTree} from '../nav/NavTree'
import {Home} from '../schema/Home'
import {HeaderRoot} from './Header.client'
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
      <input
        type="checkbox"
        id="mobilemenu"
        className={styles.mobilemenu.check()}
      />
      <div className={styles.mobilemenu()}>
        <div className={styles.mobilemenu.container()}>
          <LayoutContainer className={styles.mobilemenu.top()}>
            <Menu links={links} />
          </LayoutContainer>
          <div className={styles.mobilemenu.nav()}>
            <MobileNav />
          </div>
        </div>
      </div>
      <HeaderRoot>
        <LayoutContainer style={{height: '100%'}}>
          <Menu links={links} />
        </LayoutContainer>
      </HeaderRoot>
    </>
  )
}

async function MobileNav() {
  const docs = await cms.in(cms.workspaces.main.pages.docs).find(
    Entry().select({
      id: Entry.entryId,
      type: Entry.type,
      url: Entry.url,
      title: Entry.title,
      parent: Entry.parent
    })
  )
  const tree = [
    {id: 'home', url: '/', title: 'Home'},
    {id: 'roadmap', url: '/roadmap', title: 'Roadmap'},
    {id: 'blog', url: '/blog', title: 'Blog'},
    ...docs.map(page => {
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
    {
      parent: 'developer',
      id: 'playground',
      url: '/playground',
      title: 'Playground'
    }
  ]
  return <NavTree nav={tree} />
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
        <label htmlFor="mobilemenu" className={styles.root.mobileButton()}>
          <IcRoundHamburger className={styles.root.mobileButton.hamburger()} />
          <IcRoundClose className={styles.root.mobileButton.close()} />
        </label>
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
                className={style()}
                activeFor={link.active}
              >
                {link.label}
              </Link>
            )
          default:
            return null
        }
      })}
      <Link href="/changelog" className={style()}>
        Changelog
      </Link>
      <a href="https://demo.alinea.sh" target="_blank" className={style()}>
        Demo
      </a>
    </>
  )
}
