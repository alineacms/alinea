import {fromModule, HStack} from '@alinea/ui'
import Link from 'next/link'
import css from './Footer.module.scss'
import {Layout} from './Layout'
import {LayoutProps} from './Layout.server'
import {WebTypo} from './WebTypo'

const styles = fromModule(css)

export type FooterProps = {
  footer: LayoutProps['footer']
}

const BG_HEIGHT = 80

export function Footer({footer}: FooterProps) {
  return (
    <footer className={styles.root()}>
      {/*<svg
        className={styles.root.bg()}
        width="1440"
        height={BG_HEIGHT}
        viewBox={`0 0 1440 ${BG_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <path d={`M0 ${BG_HEIGHT}L1440 0V${BG_HEIGHT}H0Z`} />
      </svg>*/}
      <Layout.Container>
        <HStack>
          {footer?.map(section => {
            return (
              <div key={section.id}>
                <WebTypo.H4>{section.label}</WebTypo.H4>
                <nav>
                  {section.links.map(link => {
                    return (
                      <Link key={link.id} href={link.url}>
                        <a key={link.id}>{link.label}</a>
                      </Link>
                    )
                  })}
                </nav>
              </div>
            )
          })}
        </HStack>
      </Layout.Container>
    </footer>
  )
}
