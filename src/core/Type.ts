import {EntryPhase, Expand} from 'alinea/core'
import {Cursor} from 'alinea/core/pages/Cursor'
import {BinaryOp, EV, Expr, ExprData, and} from 'alinea/core/pages/Expr'
import {Callable} from 'rado/util/Callable'
import type {ComponentType} from 'react'
import {Field} from './Field.js'
import {Hint} from './Hint.js'
import {createId} from './Id.js'
import {Label} from './Label.js'
import {Meta} from './Meta.js'
import {Section, section} from './Section.js'
import {Shape} from './Shape.js'
import type {View} from './View.js'
import {RecordShape} from './shape/RecordShape.js'
import {
  assign,
  defineProperty,
  entries,
  fromEntries,
  keys
} from './util/Objects.js'

export interface EntryUrlMeta {
  phase: EntryPhase
  path: string
  parentPaths: Array<string>
  locale?: string | null
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
  view?: ComponentType
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

export class TypeTarget {
  toJSON() {
    return undefined
  }
}

export declare class TypeI<Definition = object> {
  get [Type.Data](): TypeData
}

export interface TypeI<Definition = object> extends Callable {
  (conditions?: {
    [K in keyof Definition]?: Definition[K] extends Expr<infer V>
      ? EV<V>
      : never
  }): Cursor.Find<TypeRow<Definition>>
  infer: TypeRow<Definition>
}

export type Type<Definition = object> = Definition & TypeI<Definition>

export type TypeRow<Definition> = Expand<{
  [K in keyof Definition as Definition[K] extends Expr<any>
    ? K
    : never]: Definition[K] extends Expr<infer T> ? T : never
}>

export namespace Type {
  export type Row<Definition> = TypeRow<Definition>
  export const Data = Symbol.for('@alinea/Type.Data')

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

  export function isContainer(type: Type) {
    return Boolean(type[Type.Data].meta.isContainer)
  }

  export function target(type: Type): TypeTarget {
    return type[Type.Data].target
  }

  export function field(type: Type, name: string): Field | undefined {
    return (type as Record<string, Field>)[name]
  }

  export function isType(type: any): type is Type {
    return type && Boolean(type[Type.Data])
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

function fieldsOfDefinition(
  definition: TypeDefinition
): Array<readonly [string, Field]> {
  return entries(definition).flatMap(([key, value]) => {
    if (Field.isField(value)) return [[key, value]] as const
    if (Section.isSection(value)) return entries(Section.fields(value))
    return []
  })
}

class TypeInstance<Definition extends TypeDefinition> implements TypeData {
  shape: RecordShape
  hint: Hint
  meta: TypeMeta
  sections: Array<Section> = []
  target = new TypeTarget()

  constructor(public label: Label, public definition: Definition) {
    this.meta = this.definition[Meta] || {}
    this.shape = Shape.Record(
      label,
      fromEntries(
        fieldsOfDefinition(definition).map(([key, field]) => {
          return [key, Field.shape(field as Field)]
        })
      )
    )
    this.hint = Hint.Object(
      fromEntries(
        fieldsOfDefinition(definition).map(([key, field]) => {
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
          const field = Expr(ExprData.Field({type: this.target}, key))
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
      target: {type: this.target},
      where: this.condition(input)
    })
  }

  field(def: Field, name: string) {
    return assign(Expr(ExprData.Field({type: this.target}, name)), {
      [Field.Data]: def[Field.Data]
    })
  }

  defineProperties(instance: TypeI<any>) {
    for (const [key, value] of fieldsOfDefinition(this.definition)) {
      defineProperty(instance, key, {
        value: this.field(value, key),
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
  readonly [Meta]?: TypeMeta
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
  export const meta: typeof Meta = Meta
}
