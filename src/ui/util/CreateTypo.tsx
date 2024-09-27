import {GenericStyles, Styler, styler} from '@alinea/styler'
import {
  ComponentType,
  forwardRef,
  HTMLProps,
  PropsWithChildren,
  Ref
} from 'react'
import {forwardRefWithAs, PropsWithAs} from './PropsWithAs.js'

type TypoStyles =
  | {
      link: Styler
      small: Styler
      h1: Styler
      h2: Styler
      h3: Styler
      h4: Styler
      h5: Styler
      p: Styler
      hyphenate: Styler
      monospace: Styler
    }
  | Record<string, GenericStyles>

interface Overrides {
  a?: ComponentType<any>
  h1?: ComponentType<any>
  h2?: ComponentType<any>
  h3?: ComponentType<any>
  h4?: ComponentType<any>
  h5?: ComponentType<any>
  p?: ComponentType<any>
  link?: ComponentType<any>
  small?: ComponentType<any>
}

export function createTypo(styles: TypoStyles, overrides: Overrides = {}) {
  type TypoProps = {flat?: boolean; light?: boolean}

  function Typo({
    children,
    align
  }: PropsWithChildren<{
    align?: 'left' | 'right' | 'center'
  }>) {
    return <div style={{textAlign: align}}>{children}</div>
  }

  function H1Component(
    props: PropsWithAs<TypoProps, 'h1'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = overrides.h1 ?? 'h1', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.h1(styler.merge(rest), {flat, light})}
      />
    )
  }

  function H2Component(
    props: PropsWithAs<TypoProps, 'h2'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = overrides.h2 ?? 'h2', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.h2(styler.merge(rest), {flat, light})}
      />
    )
  }

  function H3Component(
    props: PropsWithAs<TypoProps, 'h3'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = overrides.h3 ?? 'h3', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.h3(styler.merge(rest), {flat, light})}
      />
    )
  }

  function H4Component(
    props: PropsWithAs<TypoProps, 'h4'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = overrides.h4 ?? 'h4', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.h4(styler.merge(rest), {flat, light})}
      />
    )
  }

  function H5Component(
    props: PropsWithAs<TypoProps, 'h5'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = overrides.h5 ?? 'h5', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.h5(styler.merge(rest), {flat, light})}
      />
    )
  }

  function PComponent(
    props: PropsWithAs<TypoProps, 'p'>,
    ref: Ref<HTMLHeadingElement>
  ) {
    const {as: Type = overrides.p ?? 'p', flat, light, ...rest} = props
    return (
      <Type
        ref={ref}
        {...rest}
        className={styles.p(styler.merge(rest), {flat, light})}
      />
    )
  }

  const LinkComponent = forwardRef(function LinkComponent(
    props: HTMLProps<HTMLAnchorElement>,
    ref: Ref<HTMLAnchorElement>
  ) {
    const Tag = overrides.a ?? 'a'
    return (
      <Tag {...props} ref={ref} className={styles.link(styler.merge(props))} />
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
        className={styles.monospace(styler.merge(rest))}
      />
    )
  }

  function SmallComponent(
    props: PropsWithAs<{}, 'small'>,
    ref: Ref<HTMLSpanElement>
  ) {
    const {as: Type = overrides.small ?? 'small', ...rest} = props
    return (
      <Type {...props} className={styles.small(styler.merge(rest))} ref={ref} />
    )
  }

  return Object.assign(Typo, {
    H1: forwardRefWithAs<TypoProps, 'h1'>(H1Component),
    H2: forwardRefWithAs<TypoProps, 'h2'>(H2Component),
    H3: forwardRefWithAs<TypoProps, 'h3'>(H3Component),
    H4: forwardRefWithAs<TypoProps, 'h4'>(H4Component),
    H5: forwardRefWithAs<TypoProps, 'h5'>(H5Component),
    P: forwardRefWithAs<TypoProps, 'p'>(PComponent),
    Link: LinkComponent,
    link: styles.link,
    Monospace: forwardRefWithAs<{}, 'span'>(MonospaceComponent),
    Small: forwardRefWithAs<TypoProps, 'small'>(SmallComponent)
  })
}
