import styler, {type Styler} from '@alinea/styler'
import type {Link as AnyLink} from 'alinea'
import {Entry} from 'alinea/core/Entry'
import {HStack} from 'alinea/ui'
import {IcRoundClose} from 'alinea/ui/icons/IcRoundClose'
import {IcRoundHamburger} from 'alinea/ui/icons/IcRoundHamburger'
import {IcRoundSearch} from 'alinea/ui/icons/IcRoundSearch'
import {MdiGithub} from 'alinea/ui/icons/MdiGithub'
import {MdiTwitterCircle} from 'alinea/ui/icons/MdiTwitterCircle'
import {cms} from '@/cms'
import {Home} from '../schema/Home'
import {Logo} from './branding/Logo'
import {HeaderRoot, MobileMenu, SearchButton} from './Header.client'
import css from './Header.module.scss'
import {Link} from './nav/Link'
import {NavTree} from './nav/NavTree'
import {PageContainer} from './Page'

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
          <PageContainer className={styles.mobilemenu.top()}>
            <Menu links={links} />
          </PageContainer>
          <div className={styles.mobilemenu.nav()}>
            <MobileNav />
          </div>
        </div>
      </MobileMenu>
      <HeaderRoot>
        <PageContainer style={{height: '100%'}}>
          <Menu links={links} />
        </PageContainer>
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
    {id: 'roadmap', url: '/roadmap', title: 'Roadmap'},
    {id: 'blog', url: '/blog', title: 'Blog'},
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
    <HStack center gap={20} className={styles.root.inner()}>
      <Link href="/" className={styles.root.logo()}>
        <Logo />
      </Link>
      <HStack as="nav" center className={styles.root.nav()}>
        <HeaderLinks links={links} style={styles.root.nav.link} />
      </HStack>
      <HStack gap={12} center className={styles.root.extra()}>
        <SearchButton>
          <button type="button" className={styles.root.social('search')}>
            <IcRoundSearch className={styles.root.social.icon()} />
          </button>
        </SearchButton>
        <a
          href="https://github.com/alineacms/alinea"
          target="_blank"
          className={styles.root.social()}
          rel="noreferrer"
        >
          <MdiGithub className={styles.root.social.icon()} />
        </a>
        <a
          href="https://twitter.com/alineacms"
          target="_blank"
          className={styles.root.social()}
          rel="noreferrer"
        >
          <MdiTwitterCircle className={styles.root.social.icon()} />
        </a>
        <a
          href="https://www.alinea.cloud/app"
          className={styles.root.dashboard()}
        >
          Dashboard
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
        return (
          <Link
            href={link.href}
            key={link._id}
            className={style()}
            activeFor={link.fields.active}
          >
            {link.fields.label || link.title}
          </Link>
        )
      })}
      <Link href="/changelog" className={style()}>
        Changelog
      </Link>
      <SearchButton>
        <button type="button" className={styles.root.nav.link({search: true})}>
          <IcRoundSearch />
        </button>
      </SearchButton>
      {/*<a href="https://demo.alinea.sh" target="_blank" className={style()}>
        Demo
      </a>*/}
    </>
  )
}
