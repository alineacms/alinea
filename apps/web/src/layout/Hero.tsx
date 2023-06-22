import {HStack} from 'alinea/ui/Stack'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {fromModule} from 'alinea/ui/util/Styler'
import Link, {LinkProps} from 'next/link'
import {PropsWithChildren} from 'react'
import css from './Hero.module.scss'
import {LayoutContainer} from './Layout'
import {WebTypo} from './WebTypo'

const styles = fromModule(css)

const BG_HEIGHT = 80

export function Hero({children}: PropsWithChildren<{}>) {
  return (
    <LayoutContainer className={styles.root()}>
      <div className={styles.root.inner()}>{children}</div>
      <svg
        className={styles.root.bg()}
        width="1440"
        height={BG_HEIGHT}
        viewBox={`0 0 1440 ${BG_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <path d={`M0 ${BG_HEIGHT}L1440 0V${BG_HEIGHT}H0Z`} />
      </svg>
    </LayoutContainer>
  )
}

export namespace Hero {
  export function Title({children}: PropsWithChildren<{}>) {
    return <WebTypo.H1 className={styles.title()}>{children}</WebTypo.H1>
  }
  export const ByLine = styles.byLine.toElement('p')
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
