import {fromModule} from '@alinea/ui'
import {useRouter} from 'next/router'
import Logo from '../../../../public/logo.svg'
import {DemoContainer} from '../../layout/DemoContainer'
import {DemoLink} from '../../layout/DemoLink'
import css from './DemoHeader.module.scss'

const styles = fromModule(css)

export function DemoHeader() {
  return (
    <div className={styles.root()}>
      <DemoContainer>
        <div className={styles.root.row()}>
          <HeaderLogo />
          <HeaderNav />
        </div>
      </DemoContainer>
    </div>
  )
}

function HeaderLogo() {
  return (
    <DemoLink to="/" className={styles.logo()}>
      <Logo />
    </DemoLink>
  )
}

function HeaderNav() {
  const router = useRouter()
  const links = [{url: '/recipes'}]
  if (links?.length <= 0) return null

  return (
    <nav>
      {links.map((link, i) => (
        <DemoLink
          to={link.url}
          className={styles.nav.link({
            active: router?.asPath.startsWith(link.url)
          })}
          key={i}
        >
          Recipes
        </DemoLink>
      ))}
    </nav>
  )
}
