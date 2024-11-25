import styler from '@alinea/styler'
import {HStack} from 'alinea/ui/Stack'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import Link, {LinkProps} from 'next/link'
import {HTMLProps, PropsWithChildren} from 'react'
import css from './Hero.module.scss'
import {PageContainer} from './Page'
import {WebTypo} from './WebTypo'

const styles = styler(css)

const BG_HEIGHT = 80

export function Hero({children}: PropsWithChildren<{}>) {
  return (
    <PageContainer>
      <div className={styles.root.inner()}>{children}</div>
      {/*<svg
        className={styles.root.bg()}
        width="1440"
        height={BG_HEIGHT}
        viewBox={`0 0 1440 ${BG_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <path d={`M0 ${BG_HEIGHT}L1440 0V${BG_HEIGHT}H0Z`} />
    </svg>*/}
    </PageContainer>
  )
}

export namespace Hero {
  export function Title(props: PropsWithChildren<HTMLProps<HTMLElement>>) {
    return (
      <WebTypo.H1
        {...(props as any)}
        className={styles.title.mergeProps(props)()}
      />
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
    outline,
    ...props
  }: PropsWithChildren<LinkProps & {outline?: boolean}>) {
    return (
      <Link
        {...props}
        href={href}
        className={styles.action.mergeProps(props)({outline})}
      >
        <HStack center gap={8}>
          <span>{children}</span>
          <IcRoundArrowForward />
        </HStack>
      </Link>
    )
  }
}
