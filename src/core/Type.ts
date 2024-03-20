import type {EntryEditProps} from 'alinea/dashboard/view/EntryEdit'
import {Callable} from 'rado/util/Callable'
import type {ComponentType} from 'react'
import {EntryPhase} from './EntryRow.js'
import {Field} from './Field.js'
import {Hint} from './Hint.js'
import {Label} from './Label.js'
import {Meta, StripMeta} from './Meta.js'
import {Section, section} from './Section.js'
import type {View} from './View.js'
import {Cursor} from './pages/Cursor.js'
import {Expr, createExprData} from './pages/Expr.js'
import {
  BinaryOp,
  ExprData,
  OrderBy,
  Selection,
  toSelection
} from './pages/ResolveData.js'
import {RecordShape} from './shape/RecordShape.js'
import {isValidIdentifier} from './util/Identifiers.js'
import {
  assign,
  defineProperty,
  entries,
  fromEntries,
  keys
} from './util/Objects.js'
import {Expand} from './util/Types.js'

export interface EntryUrlMeta {
  phase: EntryPhase
  path: string
  parentPaths: Array<string>
  locale?: string | null
}

/** Optional settings to configure a Type */
export interface TypeMeta {
  /** Accepts entries of these types as children */
  contains?: Array<string | Type>
  /** Order children entries in the sidebar content tree */
  orderChildrenBy?: OrderBy
  /** @deprecated Use contains instead */
  isContainer?: true
  /** @deprecated Use hidden instead */
  isHidden?: true
  /** Entries do not show up in the sidebar content tree */
  hidden?: true
  /** An icon (React component) to represent this type in the dashboard */
  icon?: ComponentType

  /** A React component used to view an entry of this type in the dashboard */
  view?: ComponentType<EntryEditProps & {type: Type}>
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
  [toSelection](): Selection.Row
}

export interface TypeI<Definition = object> extends Callable {
  (): Cursor.Find<TypeRow<Definition>>
  (partial: Partial<TypeRow<Definition>>): Cursor.Typed<Definition>
}

export type Type<Definition = object> = Definition & TypeI<Definition>

type TypeRow<Definition> = Expand<{
  [K in keyof Definition as Definition[K] extends Expr<any>
    ? K
    : never]: Definition[K] extends Expr<infer T> ? T : never
}>
export namespace Type {
  export type Infer<Definition> = TypeRow<Definition>

  export const Data = Symbol.for('@alinea/Type.Data')

  export function label(type: Type): Label {
    return type[Type.Data].label
  }

  export function meta(type: Type): TypeMeta {
    return type[Type.Data].meta
  }

  export function contains(type: Type): Array<string | Type> {
    return meta(type).contains ?? []
  }

  export function isHidden(type: Type): boolean {
    return Boolean(meta(type).hidden || meta(type).isHidden)
  }

  export function shape(type: Type): RecordShape {
    return type[Type.Data].shape
  }

  export function toV1(type: Type, value: any): any {
    return shape(type).toV1(value)
  }

  export function searchableText(type: Type, value: any): string {
    return shape(type).searchableText(value).trim()
  }

  export function fields(type: Type): Record<string, Field> {
    return type as any
  }

  export function hint(type: Type) {
    return type[Type.Data].hint
  }

  export function sections(type: Type) {
    return type[Type.Data].sections
  }

  export function isContainer(type: Type) {
    const {meta} = type[Type.Data]
    return Boolean(meta.isContainer || meta.contains)
  }

  export function target(type: Type): TypeTarget {
    return type[Type.Data].target
  }

  export function field(type: Type, name: string): Field | undefined {
    return (type as any)[name]
  }

  export function isType(type: any): type is Type {
    return Boolean(type && type[Type.Data])
  }

  export function sharedData(type: Type, entryData: Record<string, unknown>) {
    const res: Record<string, unknown> = {}
    for (const [key, field] of entries(fields(type))) {
      if (Field.options(field).shared) res[key] = entryData[key]
    }
    if (keys(res).length === 0) return undefined
    return res
  }

  export function validate(type: Type) {
    for (const [key, field] of entries(fields(type))) {
      if (!isValidIdentifier(key))
        throw new Error(
          `Invalid field name "${key}" in Type "${label(
            type
          )}", must match [A-Za-z][A-Za-z0-9_]*`
        )
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
  sections: Array<Section> = []
  target: Type<Definition>

  constructor(
    public label: Label,
    public definition: Definition,
    public meta: TypeMeta
  ) {
    this.shape = new RecordShape(
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
    const seen = new Map<symbol, string>()
    function validateField(key: string, field: Field) {
      const ref = Field.ref(field)
      if (!seen.has(ref)) return seen.set(ref, key)
      console.log(definition)
      console.log(seen.get(ref))
      const fieldLabel = Field.label(field)
      throw new Error(
        `Duplicate field "${fieldLabel}" in type "${label}", found under key "${key}" and "${seen.get(
          ref
        )}"` +
          `\nSee: https://alinea.sh/docs/configuration/schema/type#fields-must-be-unique`
      )
    }
    for (const [key, value] of entries(definition)) {
      if (Field.isField(value)) {
        current[key] = value
        validateField(key, value)
      } else if (Section.isSection(value)) {
        addCurrent()
        this.sections.push(value)
        for (const [key, field] of entries(Section.fields(value))) {
          validateField(key, field)
        }
      }
    }
    addCurrent()
    const name = label as string
    const callable = {
      [name]: (...condition: Array<any>) => this.call(...condition)
    }[name] as any
    delete callable.length
    this.target = callable
    this.defineProperties(callable)
  }

  condition(input: Array<any>): ExprData | undefined {
    if (input.length === 0) return undefined
    const isConditionalRecord = input.length === 1 && !Expr.isExpr(input[0])
    const conditions = isConditionalRecord
      ? entries(input[0]).map(([key, value]) => {
          const field = Expr(ExprData.Field({type: this.target}, key))
          return Expr<boolean>(
            ExprData.BinOp(
              field[Expr.Data],
              BinaryOp.Equals,
              createExprData(value)
            )
          )
        })
      : input.map(ev => Expr<boolean>(createExprData(ev)))
    return Expr.and(...conditions)[Expr.Data]
  }

  call(...input: Array<any>) {
    return new Cursor.Typed(this.target, input[0])
  }

  field(def: Field, name: string) {
    return assign(Expr(ExprData.Field({type: this.target}, name)), {
      [Field.Data]: def[Field.Data],
      [Field.Ref]: def[Field.Ref]
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
    defineProperty(instance, toSelection, {
      value: () => {
        return Selection.Row({type: Type.target(this.target)})
      },
      enumerable: false
    })
  }
}

export interface TypeDefinition {
  [key: string]: Field<any, any> | Section
  readonly [Meta]?: TypeMeta
}

export interface TypeFields {
  [key: string]: Field<any, any> | Section
}

export interface TypeOptions<Definition> extends TypeMeta {
  fields: Definition
}

export function parseTypeParams<Definition>(
  definition: TypeOptions<Definition> | Definition
) {
  const def: any = definition
  const isOptions = 'fields' in def && !Field.isField(def.fields)
  const options: TypeMeta = (isOptions ? def : def[Meta]) ?? {}
  const d = isOptions ? def.fields : def
  return {definition: d as Definition, options}
}

/** Create a new type */
export function type<Definition extends TypeFields>(
  definition: TypeOptions<Definition>
): Type<Definition>
export function type<Definition extends TypeFields>(
  label: string,
  definition: TypeOptions<Definition>
): Type<Definition>
/** @deprecated See https://github.com/alineacms/alinea/issues/373 */
export function type<Definition extends TypeDefinition>(
  definition: Definition
): Type<StripMeta<Definition>>
/** @deprecated See https://github.com/alineacms/alinea/issues/373 */
export function type<Definition extends TypeDefinition>(
  label: string,
  definition: Definition
): Type<StripMeta<Definition>>
export function type<Definition extends TypeDefinition>(
  label: string | TypeOptions<Definition> | Definition,
  definition?: TypeOptions<Definition> | Definition
) {
  const title = typeof label === 'string' ? label : 'Anonymous'
  const def: any = typeof label === 'string' ? definition : label
  const {definition: d, options} = parseTypeParams(def)
  const instance = new TypeInstance<StripMeta<Definition>>(title, d, options)
  Type.validate(instance.target)
  return instance.target
}

export namespace type {
  export const meta: typeof Meta = Meta
}
