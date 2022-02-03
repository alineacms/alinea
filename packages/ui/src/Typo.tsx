import {HTMLAttributes, Ref} from 'react'
import css from './Typo.module.scss'
import {forwardRefWithAs, PropsWithAs} from './util/PropsWithAs'
import {fromModule} from './util/Styler'

const styles = fromModule(css)

export namespace Typo {
  type TypoProps = {flat?: boolean; light?: boolean}

  function H1Component(
    props: PropsWithAs<TypoProps, 'h1'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = 'h1', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.h1.mergeProps(rest)({flat, light})}
      />
    )
  }

  function H2Component(
    props: PropsWithAs<TypoProps, 'h2'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = 'h2', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.h2.mergeProps(rest)({flat, light})}
      />
    )
  }

  function H3Component(
    props: PropsWithAs<TypoProps, 'h3'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = 'h3', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.h3.mergeProps(rest)({flat, light})}
      />
    )
  }

  function H4Component(
    props: PropsWithAs<TypoProps, 'h4'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = 'h4', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.h4.mergeProps(rest)({flat, light})}
      />
    )
  }

  function PComponent(
    props: PropsWithAs<TypoProps, 'p'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = 'p', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.p.mergeProps(rest)({flat, light})}
      />
    )
  }

  function LinkComponent(props: HTMLAttributes<HTMLAnchorElement>) {
    return <a {...props} className={styles.link.mergeProps(props)()} />
  }

  function MonospaceComponent(props: HTMLAttributes<HTMLSpanElement>) {
    return <span {...props} className={styles.monospace.mergeProps(props)()} />
  }

  function SmallComponent(
    props: PropsWithAs<{}, 'span'>,
    ref: Ref<HTMLSpanElement>
  ) {
    const {as: Type = 'span', ...rest} = props
    return (
      <Type {...props} className={styles.small.mergeProps(props)()} ref={ref} />
    )
  }

  export const H1 = forwardRefWithAs<TypoProps, 'h1'>(H1Component)
  export const H2 = forwardRefWithAs<TypoProps, 'h2'>(H2Component)
  export const H3 = forwardRefWithAs<TypoProps, 'h3'>(H3Component)
  export const H4 = forwardRefWithAs<TypoProps, 'h4'>(H4Component)
  export const P = forwardRefWithAs<TypoProps, 'p'>(PComponent)
  export const Link = LinkComponent
  export const link = styles.link
  export const Monospace = MonospaceComponent
  export const Small = forwardRefWithAs<TypoProps, 'span'>(SmallComponent)
}
