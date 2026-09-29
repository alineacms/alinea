import styler from '@alinea/styler'
import {IcRoundChevronRight} from '@/icons'
import {HStack} from 'alinea/ui/Stack'
import Link, {type LinkProps} from 'next/link'
import type {HTMLProps, PropsWithChildren} from 'react'
import css from './Hero.module.scss'
import {PageContainer} from './Page'
import {WebTypo} from './WebTypo'

const styles = styler(css)

export function Hero({children}: PropsWithChildren<{}>) {
  return (
    <PageContainer>
      <div className={styles.root.inner()}>{children}</div>
    </PageContainer>
  )
}

export namespace Hero {
  export function Title(
    props: PropsWithChildren<HTMLProps<HTMLHeadingElement>>
  ) {
    return (
      <WebTypo.H1 {...props} className={styles.title.mergeProps(props)()} />
    )
  }

  export function ByLine(
    props: PropsWithChildren<HTMLProps<HTMLParagraphElement>>
  ) {
    return <p {...props} className={styles.byLine(styler.merge(props))} />
  }

  export function Action({
    children,
    href,
    target,
    outline,
    ...props
  }: PropsWithChildren<LinkProps & {target?: string; outline?: boolean}>) {
    return (
      <Link
        {...props}
        href={href}
        className={styles.action.mergeProps(props)({outline})}
      >
        <HStack center gap={8}>
          <span>{children}</span>
          <IcRoundChevronRight />
        </HStack>
      </Link>
    )
  }
}
