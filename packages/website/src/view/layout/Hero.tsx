import {fromModule, HStack} from '@alinea/ui'
import Link, {LinkProps} from 'next/link'
import {PropsWithChildren} from 'react'
import {MdArrowForward} from 'react-icons/md'
import css from './Hero.module.scss'

const styles = fromModule(css)

export function Hero({children}: PropsWithChildren<{}>) {
  return <div className={styles.root()}>{children}</div>
}

export namespace Hero {
  export function Title({children}: PropsWithChildren<{}>) {
    return <h1 className={styles.title()}>{children}</h1>
  }
  export function Action({children, ...props}: PropsWithChildren<LinkProps>) {
    return (
      <Link {...props}>
        <a className={styles.action()}>
          <HStack center gap={8}>
            <span>{children}</span>
            <MdArrowForward />
          </HStack>
        </a>
      </Link>
    )
  }
}
