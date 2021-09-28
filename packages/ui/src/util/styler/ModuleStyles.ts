import type {As, ComponentWithAs} from '../PropsWithAs'

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
