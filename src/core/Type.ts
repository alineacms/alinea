// Todo: extract interface and place it in core
import {Cursor} from 'alinea/backend2/pages/Cursor'
import {EV, Expr} from 'alinea/backend2/pages/Expr'
import type {EntryEditProps} from 'alinea/dashboard/view/EntryEdit'
import {Callable} from 'rado/util/Callable'
import type {ComponentType} from 'react'
import {Field} from './Field.js'
import {Hint} from './Hint.js'
import {createId} from './Id.js'
import {Label} from './Label.js'
import {Shape} from './Shape.js'
import type {View} from './View.js'
import {RecordShape} from './shape/RecordShape.js'
import {defineProperty, entries, fromEntries} from './util/Objects.js'

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
  fields: Definition
  meta: TypeMeta
}

export declare class TypeI<Fields> {
  get [Type.Data](): TypeData
}

export interface TypeI<Fields>
  extends Callable,
    Partial<Record<string, Field>> {
  (conditions?: {
    [K in keyof Fields]?: Fields[K] extends Expr<infer V> ? EV<V> : never
  }): Cursor.Find<TypeRow<Fields>>
}

export type Type<Fields = object> = Fields & TypeI<Fields>

export type TypeRow<Fields> = {
  [K in keyof Fields as Fields[K] extends Expr<any>
    ? K
    : never]: Fields[K] extends Expr<infer T> ? T : never
}

export namespace Type {
  export type Row<Fields> = TypeRow<Fields>
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

class TypeInstance<Fields extends Definition> implements TypeData {
  shape: RecordShape
  hint: Hint
  meta: TypeMeta

  constructor(public label: Label, public fields: Fields) {
    this.meta = this.fields[Type.Meta] || {}
    this.shape = Shape.Record(
      label,
      fromEntries(
        entries(fields).map(([key, field]) => {
          return [key, Field.shape(field)]
        })
      )
    )
    this.hint = Hint.Object(
      fromEntries(
        entries(fields).map(([key, field]) => {
          return [key, Field.hint(field)]
        })
      )
    )
  }

  call(...input: Array<any>) {
    throw 'todo'
  }

  defineProperties(instance: any) {
    for (const [key, value] of entries(this.fields))
      defineProperty(instance, key, {
        value,
        enumerable: true,
        configurable: true
      })
    defineProperty(instance, Type.Data, {
      value: this,
      enumerable: false
    })
  }
}

export interface Definition {
  [key: string]: Field<any, any>
  [Type.Meta]?: TypeMeta
}

/** Create a new type */
export function type<Fields extends Definition>(
  label: Label,
  fields: Fields
): Type<Fields> {
  const name = String(label)
  const instance = new TypeInstance(label, fields)
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
