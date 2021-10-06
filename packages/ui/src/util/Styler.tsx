import {forwardRef} from 'react'
import type {As, ComponentWithAs} from './PropsWithAs'

type VariantImpl<T extends string> = T | {[K in T]?: boolean}
export type Variant<T extends string> = VariantImpl<T> | Array<VariantImpl<T>>

export type Styler = {
  (): string
  className: string
  with(...extra: Array<string | Styler | undefined>): Styler
  mergeProps(attrs: {[key: string]: any} | undefined): Styler
  sub(sub: string): Styler
  is(state: Variant<any>): Styler
  mod(modifier: Variant<any>): Styler
  toSelector(): string
  toString(): string
  toElement<Props, Type extends As>(element: Type): ComponentWithAs<Props, Type>
}

type GenericStyler = Styler & {[key: string]: GenericStyler}
type GenericStyles = {[key: string]: GenericStyler}

type Style<State> = string extends State
  ? GenericStyles
  : State extends string
  ? State extends `${infer Parent}-${infer Sub}`
    ? {[P in Parent]: Style<Sub>}
    : {[P in State]: Styler}
  : never

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never

export type ModuleStyles<M> = {} extends M
  ? GenericStyles
  : UnionToIntersection<Style<keyof M>>

const cache = new Map()

const variant = (
  key: string,
  selector: Styler,
  state: Variant<any>,
  variants?: Map<string, string>
) => {
  if (!state) return selector
  const getVariant = (name: string) => {
    const variant = `${key}-${name}`
    return (variants && variants.get(variant)) || variant
  }
  if (Array.isArray(state))
    return styler(`${state.map(getVariant).join(' ')} ${selector}`, variants)
  if (typeof state === 'object')
    return selector.with(
      ...Object.entries(state)
        .map(([cl, active]) => active && cl)
        .filter(v => v)
        .map(_ => getVariant(_ as any))
    )
  return styler(`${getVariant(state)} ${selector}`, variants)
}

const createStyler = (
  input: any,
  value: string,
  variants?: Map<string, string>
) => {
  Object.defineProperties(input, {
    with: {
      enumerable: false,
      value(...extra: Array<string | Styler>) {
        return styler(
          ([] as Array<string | Styler>)
            .concat(extra)
            .concat(value)
            .filter(v => v)
            .join(' '),
          variants
        )
      }
    },
    mergeProps: {
      enumerable: false,
      value(props: {[key: string]: any}) {
        if (!props) return this
        const a = props.class
        const b = props.className
        // tslint:disable-next-line:triple-equals
        return styler(value, variants).with(a, a != b && b)
      }
    },
    is: {
      enumerable: false,
      value(state: Variant<any>) {
        return variant('is', this, state, variants)
      }
    },
    mod: {
      enumerable: false,
      value(state: Variant<any>) {
        return variant('mod', this, state, variants)
      }
    },
    toSelector: {
      enumerable: false,
      value() {
        const joined = String(value).split(' ').join('.')
        if (joined.length > 0) return `.${joined}`
        return ''
      }
    },
    toElement: {
      enumerable: false,
      value(element: any) {
        return Object.assign(
          // eslint-disable-next-line react/display-name
          forwardRef(({as: Tag = element, ...props}: any, ref) => (
            <Tag {...props} ref={ref} className={this.mergeProps(props)()} />
          )),
          {displayName: value}
        )
      }
    },
    toString: {
      value() {
        return String(value)
      }
    }
  })
}

export const styler = (
  selector: string,
  variants?: Map<string, string>
): Styler => {
  if (!variants && cache.has(selector)) return cache.get(selector)
  const inst: any = () => selector
  createStyler(inst, selector, variants)
  cache.set(selector, inst)
  return inst
}

const variantKeys = new Set(['is', 'mod'])

export const fromModule = <M extends {[key: string]: string}>(
  styles: M
): ModuleStyles<M> => {
  const res: {[key: string]: any} = {}
  const variants: Map<string, string> = new Map()
  for (const key of Object.keys(styles)) {
    const parts = key.split('-')
    if (variantKeys.has(parts[0])) variants.set(key, styles[key])
    let parent = ''
    let target: any = res
    parts.forEach(sub => {
      parent = parent ? `${parent}-${sub}` : sub
      if (!target[sub]) target[sub] = styler(styles[parent] || parent, variants)
      target = target[sub]
    })
  }
  return res as any
}
