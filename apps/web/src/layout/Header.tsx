import styler from '@alinea/styler'
import type {Link as AnyLink} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundSearch} from 'alinea/ui/icons/IcRoundSearch'
import {cms} from '@/cms'
import {IcRoundHamburger} from '@/icons'
import {Home} from '../schema/Home'
import {Logo} from './branding/Logo'
import {HeaderRoot, MobileMenu, SearchButton} from './Header.client'
import css from './Header.module.scss'
import {Link} from './nav/Link'
import {NavTree} from './nav/NavTree'

const styles = styler(css)

export type HeaderLink = AnyLink<{label: string; active: string}>

export async function Header() {
  const links = await cms.get({
    type: Home,
    select: Home.links
  })
  return (
    <>
      <input
        type="checkbox"
        id="mobilemenu"
        className={styles.mobilemenu.check()}
      />
      <MobileMenu className={styles.mobilemenu()}>
        <div className={styles.mobilemenu.container()}>
          <div className={styles.mobilemenu.top()}>
            <Menu links={links} />
          </div>
          <div className={styles.mobilemenu.nav()}>
            <MobileNav />
          </div>
        </div>
      </MobileMenu>
      <HeaderRoot>
        <Menu links={links} />
      </HeaderRoot>
    </>
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
}

function Menu({links}: MenuProps) {
  return (
    <div className={styles.menu()}>
      <Link href="/" className={styles.menu.logo()} title="Alinea CMS">
        <Logo className={styles.menu.logo.mark()} />
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
        <SearchButton>
          <button
            type="button"
            className={styles.menu.search()}
            title="Search"
            aria-label="Search"
          >
            <IcRoundSearch className={styles.menu.search.icon()} />
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
        <Link href="/docs/getting-started" className={styles.menu.cta()}>
          Get started
        </Link>
        <label
          htmlFor="mobilemenu"
          className={styles.menu.mobileButton()}
          aria-label="Toggle menu"
        >
          <IcRoundHamburger className={styles.menu.mobileButton.hamburger()} />
          <IcRoundClose className={styles.menu.mobileButton.close()} />
        </label>
      </div>
    </div>
  )
}
