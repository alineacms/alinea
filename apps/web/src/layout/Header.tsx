import styler from '@alinea/styler'
import type {Link as AnyLink} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import {cms} from '@/cms'
import {IcRoundClose, IcRoundHamburger, IcRoundSearch} from '@/icons'
import {Home} from '../schema/Home'
import {Logo} from './branding/Logo'
import {
  HeaderRoot,
  MobileMenu,
  MobileMenuButton,
  MobileMenuProvider,
  SearchButton
} from './Header.client'
import css from './Header.module.scss'
import {Link} from './nav/Link'
import {NavTree} from './nav/NavTree'

const styles = styler(css)

export type HeaderLink = AnyLink<{label: string; active: string}>

export interface HeaderProps {
  /** Text shown next to the logo, eg. "Cloud" */
  badge?: string
}

export async function Header({badge}: HeaderProps) {
  const links = await cms.get({
    type: Home,
    select: Home.links
  })
  return (
    <MobileMenuProvider>
      <MobileMenu>
        <div className={styles.mobilemenu.container()}>
          <div className={styles.mobilemenu.top()}>
            <Menu links={links} badge={badge} />
          </div>
          <div className={styles.mobilemenu.nav()}>
            <MobileNav />
          </div>
        </div>
      </MobileMenu>
      <HeaderRoot>
        <Menu links={links} badge={badge} shortcut />
      </HeaderRoot>
    </MobileMenuProvider>
  )
}

async function MobileNav() {
  const docs = await cms.find({
    location: cms.workspaces.main.pages.docs,
    select: {
      id: Entry.id,
      type: Entry.type,
      url: Entry.url,
      title: Entry.title,
      parent: Entry.parentId
    }
  })
  const tree = [
    {id: 'home', url: '/', title: 'Home'},
    {id: 'blog', url: '/blog', title: 'Blog'},
    {id: 'changelog', url: '/changelog', title: 'Changelog'},
    {id: 'cloud', url: '/cloud', title: 'Cloud'},
    {
      id: 'github',
      url: 'https://github.com/alineacms/alinea',
      title: 'GitHub'
    },
    ...docs.map(page => {
      if (page.parent) return page
      return {...page, parent: 'docs'}
    }),
    {id: 'docs', url: '/docs', title: 'Docs'}
  ]
  return <NavTree nav={tree} />
}

interface MenuProps {
  links: Array<HeaderLink>
  badge?: string
  /** Opens search on ⌘K, only one of the rendered menus should */
  shortcut?: boolean
}

function Menu({links, badge, shortcut}: MenuProps) {
  return (
    <div className={styles.menu()}>
      <Link href="/" className={styles.menu.logo()} title="Alinea CMS">
        <Logo className={styles.menu.logo.mark()} />
        {badge && <span className={styles.menu.logo.badge()}>{badge}</span>}
      </Link>
      <nav className={styles.menu.nav()}>
        {links?.map(link => {
          return (
            <Link
              href={link.href}
              key={link._id}
              className={styles.menu.nav.link()}
              activeFor={link.fields.active || undefined}
            >
              {link.fields.label || link.title}
            </Link>
          )
        })}
      </nav>
      <div className={styles.menu.extra()}>
        <SearchButton shortcut={shortcut}>
          <button
            type="button"
            className={styles.menu.search()}
            title="Search"
            aria-label="Search the docs"
          >
            <IcRoundSearch className={styles.menu.search.icon()} />
            <span className={styles.menu.search.label()}>Search the docs</span>
            <kbd className={styles.menu.search.shortcut()}>⌘K</kbd>
          </button>
        </SearchButton>
        <a
          href="https://github.com/alineacms/alinea"
          target="_blank"
          rel="noopener"
          className={styles.menu.github()}
        >
          GitHub
        </a>
        <Link href="/docs/quickstart" className={styles.menu.cta()}>
          Get started
        </Link>
        <MobileMenuButton className={styles.menu.mobileButton()}>
          <IcRoundHamburger className={styles.menu.mobileButton.hamburger()} />
          <IcRoundClose className={styles.menu.mobileButton.close()} />
        </MobileMenuButton>
      </div>
    </div>
  )
}
