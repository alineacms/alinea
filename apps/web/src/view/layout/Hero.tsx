import {fromModule, HStack} from '@alinea/ui'
import {IcRoundArrowForward} from '@alinea/ui/icons/IcRoundArrowForward'
import Link, {LinkProps} from 'next/link'
import {PropsWithChildren} from 'react'
import css from './Hero.module.scss'
import {Layout} from './Layout'
import {WebTypo} from './WebTypo'

const styles = fromModule(css)

const BG_HEIGHT = 600

export function Hero({children}: PropsWithChildren<{}>) {
  return (
    <Layout.Container className={styles.root()}>
      <svg
        className={styles.root.bg()}
        width="1440"
        height={BG_HEIGHT}
        viewBox={`0 0 1440 ${BG_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <path d={`M0 0H1440V${BG_HEIGHT - 80}L0 ${BG_HEIGHT}V0Z`} />
      </svg>
      <div className={styles.root.inner()}>{children}</div>
    </Layout.Container>
  )
}

export namespace Hero {
  export function Title({children}: PropsWithChildren<{}>) {
    return <WebTypo.H1 className={styles.title()}>{children}</WebTypo.H1>
  }
  export const ByLine = styles.byLine.toElement('p')
  export function Action({children, ...props}: PropsWithChildren<LinkProps>) {
    return (
      <Link {...props}>
        <a className={styles.action()}>
          <HStack center gap={8}>
            <span>{children}</span>
            <IcRoundArrowForward />
          </HStack>
        </a>
      </Link>
    )
  }
}
