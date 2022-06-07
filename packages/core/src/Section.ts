import type {InputState} from '@alinea/editor/InputState'
import {ComponentType, createElement, isValidElement, ReactElement} from 'react'
import {Field} from './Field'
import {Lazy} from './util/Lazy'
import {UnionToIntersection} from './util/Types'

export class Section<R = any, T = R> {
  constructor(
    public fields: Section.Fields | undefined,
    public view?: ComponentType<{state: InputState}>
  ) {}
}

export namespace Section {
  type Presentational = ReactElement

  export type Fields = Lazy<
    {
      // This used to be Lazy<Field<any, any, any>> but it seems the compiler
      // would infer the third type param for Field to be any
      [key: string]: any
    } & {
      id?: never
      workspace?: never
      root?: never
      type?: never
    }
  >

  type InferRawFields<S> = S extends Presentational
    ? never
    : S extends Section<infer U, any>
    ? U
    : S extends Lazy<infer U>
    ? U extends {[key: string]: any}
      ? {
          [K in keyof U]: U[K] extends Lazy<Field<infer T, infer M, infer Q>>
            ? T
            : never
        }
      : never
    : never

  type InferTransformedFields<S> = S extends Presentational
    ? never
    : S extends Section<any, infer U>
    ? U
    : S extends Lazy<infer U>
    ? U extends {[key: string]: any}
      ? {
          [K in keyof U]: U[K] extends Lazy<Field<infer T, infer M, infer Q>>
            ? Q
            : never
        }
      : never
    : never

  export type Input<T = any> = Section<T> | Presentational | Fields

  export type RawFieldsOf<T> = UnionToIntersection<InferRawFields<T>>
  export type TransformedFieldsOf<T> = UnionToIntersection<
    InferTransformedFields<T>
  >

  export function from<T>(input: Input<T>): Section<T> {
    if (input instanceof Section) return input
    if (isValidElement(input)) return new Section(undefined, () => input)
    return new Section(input, undefined)
  }

  export function withView<
    T extends Section,
    // We're not expecting a T return because we'd like factories to use
    // Section types so the underlying fields can be inferred. This reduces
    // type safety a little and should probably be revised later.
    Factory extends (...args: Array<any>) => Section
  >(create: Factory, view: ComponentType<{state: InputState; section: T}>) {
    return ((...args: Parameters<Factory>) => {
      const section = create(...args)
      section.view = ({state}) =>
        createElement(view, {state, section: section as T})
      return section
    }) as Factory
  }
}
