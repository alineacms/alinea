import { fromModule, HStack } from '@alinea/ui'
import { IcRoundArrowForward } from '@alinea/ui/icons/IcRoundArrowForward'
import Link, { LinkProps } from 'next/link'
import { PropsWithChildren } from 'react'
import { Container } from './Container'
import css from './Hero.module.scss'
import { WebTypo } from './WebTypo'

const styles = fromModule(css)

export function Hero({children}: PropsWithChildren<{}>) {
  return (
    <Container className={styles.root()}>
      <svg
        className={styles.root.bg()}
        width="1440"
        height="814"
        viewBox="0 0 1440 814"
        preserveAspectRatio="none"
      >
        <path d="M0 0H1440V689L0 814V0Z" />
      </svg>
      <div className={styles.root.inner()}>{children}</div>
    </Container>
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
