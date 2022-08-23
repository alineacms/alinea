import {
  ComponentType,
  forwardRef,
  HTMLProps,
  PropsWithChildren,
  Ref
} from 'react'
import {forwardRefWithAs, PropsWithAs} from './PropsWithAs'
import {GenericStyles, Styler} from './Styler'

type TypoStyles =
  | {
      root: Styler
      h1: Styler
      link: Styler
      small: Styler
      h2: Styler
      h3: Styler
      h4: Styler
      p: Styler
      hyphenate: Styler
      monospace: Styler
    }
  | GenericStyles

export function createTypo(
  styles: TypoStyles,
  InternalLink?: ComponentType<any>
) {
  type TypoProps = {flat?: boolean; light?: boolean}

  function Typo({
    children,
    align
  }: PropsWithChildren<{
    align?: 'left' | 'right' | 'center'
  }>) {
    return (
      <div style={{textAlign: align}} className={styles.root()}>
        {children}
      </div>
    )
  }

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

  const LinkComponent = forwardRef(function LinkComponent(
    props: HTMLProps<HTMLAnchorElement>,
    ref: Ref<HTMLAnchorElement>
  ) {
    if (InternalLink) {
      return (
        <InternalLink
          {...props}
          ref={ref}
          className={styles.link.mergeProps(props)()}
        />
      )
    }
    return (
      <a {...props} ref={ref} className={styles.link.mergeProps(props)()} />
    )
  })

  function MonospaceComponent(
    props: PropsWithAs<{}, 'span'>,
    ref: Ref<HTMLSpanElement>
  ) {
    const {as: Type = 'span', ...rest} = props
    return (
      <Type
        {...props}
        ref={ref}
        className={styles.monospace.mergeProps(props)()}
      />
    )
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

  return Object.assign(Typo, {
    H1: forwardRefWithAs<TypoProps, 'h1'>(H1Component),
    H2: forwardRefWithAs<TypoProps, 'h2'>(H2Component),
    H3: forwardRefWithAs<TypoProps, 'h3'>(H3Component),
    H4: forwardRefWithAs<TypoProps, 'h4'>(H4Component),
    P: forwardRefWithAs<TypoProps, 'p'>(PComponent),
    Link: LinkComponent,
    link: styles.link,
    Monospace: forwardRefWithAs<{}, 'span'>(MonospaceComponent),
    Small: forwardRefWithAs<TypoProps, 'span'>(SmallComponent)
  })
}
