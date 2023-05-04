import {Cursor} from 'alinea/backend2/pages/Cursor'
import {BinaryOp, EV, Expr, ExprData, and} from 'alinea/backend2/pages/Expr'
import type {EntryEditProps} from 'alinea/dashboard/view/EntryEdit'
import {Callable} from 'rado/util/Callable'
import type {ComponentType} from 'react'
import {Field} from './Field.js'
import {Hint} from './Hint.js'
import {createId} from './Id.js'
import {Label} from './Label.js'
import {Section, section} from './Section.js'
import {Shape} from './Shape.js'
import type {View} from './View.js'
import {RecordShape} from './shape/RecordShape.js'
import {defineProperty, entries, fromEntries, keys} from './util/Objects.js'

export interface EntryUrlMeta {
  path: string
  parentPaths: Array<string>
  locale?: string
}

/** Optional settings to configure a Type */
export interface TypeMeta {
  /** Entries can be created as children of this entry */
  isContainer?: true
  /** Entries do not show up in the sidebar content tree */
  isHidden?: true
  /** Accepts entries of these types as children */
  contains?: Array<string>
  /** An icon (React component) to represent this type in the dashboard */
  icon?: ComponentType

  /** A React component used to view an entry of this type in the dashboard */
  view?: ComponentType<EntryEditProps>
  /** A React component used to view a row of this type in the dashboard */
  summaryRow?: View<any>
  /** A React component used to view a thumbnail of this type in the dashboard */
  summaryThumb?: View<any>

  /** Create indexes on fields of this type */
  // index?: (this: Fields) => Record<string, Array<Expr<any>>>

  entryUrl?: (meta: EntryUrlMeta) => string
}

export interface TypeData {
  label: Label
  shape: RecordShape
  hint: Hint
  definition: TypeDefinition
  meta: TypeMeta
  sections: Array<Section>
  target: TypeTarget
}

export class TypeTarget {}

export declare class TypeI<Definition = object> {
  get [Type.Data](): TypeData
}

export interface TypeI<Definition = object>
  extends Callable,
    Record<string, Field> {
  (conditions?: {
    [K in keyof Definition]?: Definition[K] extends Expr<infer V>
      ? EV<V>
      : never
  }): Cursor.Find<TypeRow<Definition>>
}

export type Type<Definition = object> = Definition & TypeI<Definition>

export type TypeRow<Definition> = {
  [K in keyof Definition as Definition[K] extends Expr<any>
    ? K
    : never]: Definition[K] extends Expr<infer T> ? T : never
}

export namespace Type {
  export type Row<Definition> = TypeRow<Definition>
  export const Data = Symbol('Type.Data')
  export const Meta = Symbol('Type.Meta')

  export function label(type: Type): Label {
    return type[Type.Data].label
  }

  export function meta(type: Type): TypeMeta {
    return type[Type.Data].meta
  }

  export function shape(type: Type): RecordShape {
    return type[Type.Data].shape
  }

  export function hint(type: Type) {
    return type[Type.Data].hint
  }

  export function sections(type: Type) {
    return type[Type.Data].sections
  }

  export function target(type: Type) {
    return type[Type.Data].target
  }

  export function blankEntry(
    name: string,
    type: Type
  ): {
    id: string
    type: string
    [key: string]: any
  } {
    return {
      ...Type.shape(type).create(),
      type: name,
      id: createId()
    }
  }
}

class TypeInstance<Definition extends TypeDefinition> implements TypeData {
  shape: RecordShape
  hint: Hint
  meta: TypeMeta
  sections: Array<Section> = []
  target = new TypeTarget()

  constructor(public label: Label, public definition: Definition) {
    this.meta = this.definition[Type.Meta] || {}
    this.shape = Shape.Record(
      label,
      fromEntries(
        entries(definition)
          .filter(([, field]) => Field.isField(field))
          .map(([key, field]) => {
            return [key, Field.shape(field as Field)]
          })
      )
    )
    this.hint = Hint.Object(
      fromEntries(
        entries(definition)
          .filter(([, field]) => Field.isField(field))
          .map(([key, field]) => {
            return [key, Field.hint(field as Field)]
          })
      )
    )
    let current: Record<string, Field> = {}
    const addCurrent = () => {
      if (keys(current).length > 0)
        this.sections.push(section({definition: current}))
      current = {}
    }
    for (const [key, value] of entries(definition)) {
      if (Field.isField(value)) {
        current[key] = value
      } else if (Section.isSection(value)) {
        addCurrent()
        this.sections.push(value)
      }
    }
    addCurrent()
  }

  condition(input: Array<any>): ExprData | undefined {
    if (input.length === 0) return undefined
    const isConditionalRecord = input.length === 1 && !Expr.isExpr(input[0])
    const conditions = isConditionalRecord
      ? entries(input[0]).map(([key, value]) => {
          const field = Expr(ExprData.Field(this.target, key))
          return Expr(
            ExprData.BinOp(field[Expr.Data], BinaryOp.Equals, ExprData(value))
          )
        })
      : input.map(ev => Expr(ExprData(ev)))
    return and(...conditions)[Expr.Data]
  }

  call(...input: Array<any>) {
    return new Cursor.Find({
      id: createId(),
      target: this.target,
      where: this.condition(input)
    })
  }

  defineProperties(instance: TypeI<any>) {
    for (const [key, value] of entries(this.definition)) {
      if (Field.isField(value))
        defineProperty(instance, key, {
          value,
          enumerable: true,
          configurable: true
        })
      if (Section.isSection(value))
        for (const [k, v] of entries(Section.fields(value)))
          defineProperty(instance, k, {
            value: v,
            enumerable: true,
            configurable: true
          })
    }
    defineProperty(instance, Type.Data, {
      value: this,
      enumerable: false
    })
  }
}

export interface TypeDefinition {
  [key: string]: Field<any, any> | Section
  [Type.Meta]?: TypeMeta
}

/** Create a new type */
export function type<Definition extends TypeDefinition>(
  label: Label,
  definition: Definition
): Type<Definition> {
  const name = String(label)
  const instance = new TypeInstance(label, definition)
  const callable: any = {
    [name]: (...args: Array<any>) => instance.call(...args)
  }[name]
  delete callable.name
  delete callable.length
  instance.defineProperties(callable)
  return callable
}

export namespace type {
  export const meta: typeof Type.Meta = Type.Meta
}
