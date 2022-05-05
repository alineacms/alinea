import {fromModule, HStack} from '@alinea/ui'
import {IcRoundArrowForward} from '@alinea/ui/icons/IcRoundArrowForward'
import Link, {LinkProps} from 'next/link'
import {PropsWithChildren} from 'react'
import {Container} from './Container'
import css from './Hero.module.scss'

const styles = fromModule(css)

export function Hero({children}: PropsWithChildren<{}>) {
  return (
    <Container className={styles.root()}>
      <div className={styles.root.inner()}>{children}</div>
    </Container>
  )
}

export namespace Hero {
  export function Title({children}: PropsWithChildren<{}>) {
    return <h1 className={styles.title()}>{children}</h1>
  }
  export const ByLine = styles.byLine.toElement('p')
  export function Action({children, ...props}: PropsWithChildren<LinkProps>) {
    return (
      <Link {...props}>
        <a className={styles.action()} style={{backgroundColor: props.color}}>
          <HStack center gap={8}>
            <span>{children}</span>
            <IcRoundArrowForward />
          </HStack>
        </a>
      </Link>
    )
  }
}
