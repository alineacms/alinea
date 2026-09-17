import {styler, type GenericStyles, type Styler} from '@alinea/styler'
import {
  forwardRef,
  type ComponentType,
  type HTMLProps,
  type PropsWithChildren
} from 'react'

type TypoStyles =
  | {
      root: Styler
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
  a?: ComponentType<HTMLProps<HTMLAnchorElement>>
  h1?: ComponentType<HTMLProps<HTMLHeadingElement>>
  h2?: ComponentType<HTMLProps<HTMLHeadingElement>>
  h3?: ComponentType<HTMLProps<HTMLHeadingElement>>
  h4?: ComponentType<HTMLProps<HTMLHeadingElement>>
  h5?: ComponentType<HTMLProps<HTMLHeadingElement>>
  p?: ComponentType<HTMLProps<HTMLParagraphElement>>
  link?: ComponentType<HTMLProps<HTMLAnchorElement>>
  small?: ComponentType<HTMLProps<HTMLElement>>
}

interface TypoHeadingProps {
  as?: ComponentType<any> | string
  flat?: boolean
  light?: boolean
}

function withAs(
  Component: ComponentType<any>
): ComponentType<any> {
  return forwardRef(Component as any)
}

export function createTypo(styles: TypoStyles, overrides: Overrides = {}) {
  function Typo({children, align}: PropsWithChildren<{align?: 'left' | 'right' | 'center'}>) {
    return (
      <div style={{textAlign: align}} className={styles.root()}>
        {children}
      </div>
    )
  }

  function H1Component({as: Type = overrides.h1 ?? 'h1', flat, light, ...rest}: TypoHeadingProps, ref: any) {
    return <Type ref={ref} {...rest} className={styles.h1(styler.merge(rest as any), {flat, light})} />
  }

  function H2Component({as: Type = overrides.h2 ?? 'h2', flat, light, ...rest}: TypoHeadingProps, ref: any) {
    return <Type ref={ref} {...rest} className={styles.h2(styler.merge(rest as any), {flat, light})} />
  }

  function H3Component({as: Type = overrides.h3 ?? 'h3', flat, light, ...rest}: TypoHeadingProps, ref: any) {
    return <Type ref={ref} {...rest} className={styles.h3(styler.merge(rest as any), {flat, light})} />
  }

  function H4Component({as: Type = overrides.h4 ?? 'h4', flat, light, ...rest}: TypoHeadingProps, ref: any) {
    return <Type ref={ref} {...rest} className={styles.h4(styler.merge(rest as any), {flat, light})} />
  }

  function H5Component({as: Type = overrides.h5 ?? 'h5', flat, light, ...rest}: TypoHeadingProps, ref: any) {
    return <Type ref={ref} {...rest} className={styles.h5(styler.merge(rest as any), {flat, light})} />
  }

  function PComponent({as: Type = overrides.p ?? 'p', flat, light, ...rest}: TypoHeadingProps, ref: any) {
    return <Type ref={ref} {...rest} className={styles.p(styler.merge(rest as any), {flat, light})} />
  }

  const LinkComponent = forwardRef<HTMLAnchorElement, HTMLProps<HTMLAnchorElement>>(
    function LinkComponent(props, ref) {
      const Tag = overrides.a ?? 'a'
      return <Tag {...(props as any)} ref={ref} className={styles.link(styler.merge(props as any))} />
    }
  )

  function MonospaceComponent({as: Type = 'span', ...rest}: {as?: ComponentType<any> | string}, ref: any) {
    return <Type {...(rest as any)} ref={ref} className={styles.monospace(styler.merge(rest as any))} />
  }

  function SmallComponent({as: Type = overrides.small ?? 'small', ...rest}: TypoHeadingProps, ref: any) {
    return <Type {...(rest as any)} className={styles.small(styler.merge(rest as any))} ref={ref} />
  }

  return Object.assign(Typo, {
    H1: withAs(H1Component),
    H2: withAs(H2Component),
    H3: withAs(H3Component),
    H4: withAs(H4Component),
    H5: withAs(H5Component),
    P: withAs(PComponent),
    Link: LinkComponent,
    link: styles.link,
    Monospace: withAs(MonospaceComponent),
    Small: withAs(SmallComponent)
  })
}