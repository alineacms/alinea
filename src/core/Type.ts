// Todo: extract interface and place it in core
import type {Pages} from 'alinea/backend/Pages'
import type {EntryEditProps} from 'alinea/dashboard/view/EntryEdit'
import type {CollectionImpl, CursorImpl} from 'alinea/store'
import {Collection, Expr, SelectionInput} from 'alinea/store'
import type {ComponentType} from 'react'
import {Entry} from './Entry.js'
import {Field} from './Field.js'
import {Hint} from './Hint.js'
import {createId} from './Id.js'
import {Label} from './Label.js'
import {Section} from './Section.js'
import {Shape, ShapeInfo} from './Shape.js'
import type {View} from './View.js'
import {RecordShape} from './shape/RecordShape.js'
import {Lazy} from './util/Lazy.js'
import {LazyRecord} from './util/LazyRecord.js'

export namespace Type {
  export type Raw<T> = T extends TypeConfig<infer U, any> ? U : never
  /** Infer the field types */
  export type Of<T> = T extends TypeConfig<any, infer U> ? U : never
}

export interface EntryUrlMeta {
  path: string
  parentPaths: Array<string>
  locale?: string
}

/** Optional settings to configure a Type */
export type TypeOptions<R, Q> = {
  /** Entries can be created as children of this entry */
  isContainer?: boolean
  /** Entries do not show up in the sidebar content tree */
  isHidden?: boolean
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
  // Todo: solve infered type here
  index?: (fields: any) => Record<string, Array<Expr<any>>>

  entryUrl?: (meta: EntryUrlMeta) => string

  transform?: (field: Expr<R>, pages: Pages<any>) => Expr<Q> | undefined
}

export class TypeConfig<R = any, T = R> {
  fields: Record<string, Field<any, any>> = {}
  shape: RecordShape<any>

  constructor(
    public label: Label,
    public sections: Array<Section>,
    public options: TypeOptions<R, T>
  ) {
    this.shape = Shape.Record(
      label,
      Object.fromEntries(
        sections
          .flatMap<[string, Field<any, any>]>(section =>
            LazyRecord.iterate(section.fields || {})
          )
          .filter(([, field]) => field.shape)
          .map(([key, field]) => {
            return [key, field.shape!]
          })
      )
    )
    for (const section of this.sections) {
      if (section.fields) Object.assign(this.fields, Lazy.get(section.fields))
    }
  }

  get hint() {
    const fields: Record<string, Field<any, any>> = {}
    for (const section of this.sections) {
      if (section.fields) Object.assign(fields, Lazy.get(section.fields))
    }
    const hints = Object.entries(fields).map(([key, field]) => {
      return [key, field.hint]
    })
    return Hint.Object(Object.fromEntries(hints))
  }

  /** Create a new empty instance of this type's fields */
  empty() {
    return this.shape.create()
  }

  hasField(key: string) {
    try {
      return this.field(key), true
    } catch (e) {
      return false
    }
  }

  /** Get a field by name */
  field(key: string) {
    const field = LazyRecord.get(this.fields, key)
    if (!field)
      throw new Error(`No such field: "${key}" in type "${this.label}"`)
    return field
  }

  [Symbol.iterator]() {
    return Object.entries(this.fields)[Symbol.iterator]()
  }

  get isContainer() {
    return Boolean(this.options.isContainer)
  }

  get entryUrl() {
    return this.options.entryUrl
  }

  selection(cursor: CursorImpl<R>, pages: Pages<any>): Expr<any> | undefined {
    const computed: Record<string, SelectionInput> = {}
    let isComputed = false
    for (const [key, field] of this) {
      if (!field.transform) continue
      const selection = field.transform(cursor.get(key), pages)
      if (!selection) continue
      computed[key] = selection
      isComputed = true
    }
    if (this.options.transform)
      return this.options.transform(
        (cursor.fields.with(computed) as any).toExpr(),
        pages
      )
    if (!isComputed) return
    return new Expr(cursor.fields.with(computed).expr)
  }

  configure<Q = T>(options: TypeOptions<R, Q>): TypeConfig<R, Q> {
    return new TypeConfig<R, Q>(this.label, this.sections, {
      ...this.options,
      ...options
    } as TypeOptions<R, Q>)
  }

  toType(name: string): Type<R, T> {
    return new Type(name, this)
  }
}

/** Describes the structure of an entry by their fields and type */
export class Type<R = any, T = R>
  extends TypeConfig<R, T>
  implements ShapeInfo
{
  parents = []

  constructor(public name: string, config: TypeConfig<R, T>) {
    super(config.label, config.sections, config.options)
  }

  get hint() {
    const fields: Record<string, Field<any, any>> = {}
    for (const section of this.sections) {
      if (section.fields) Object.assign(fields, Lazy.get(section.fields))
    }
    const hints = Object.entries(fields).map(([key, field]) => {
      return [key, field.hint]
    })
    return Hint.Definition(this.name, {
      type: Hint.Literal(this.name),
      ...Object.fromEntries(hints)
    })
  }

  /** Create a new Entry instance of this type */
  create() {
    return {
      ...this.empty(),
      type: this.name,
      id: createId()
    } as Entry & T
  }

  collection(): CollectionImpl<T> {
    const alias = this.name
    const fields = Entry
    const res = new Collection<T>('Entry', {
      where: fields.type.is(alias)
    })
    // Todo: this is used in Pages(Multiple).whereType() and needs a clean way
    // of passing this option
    ;(res as any).__options.alias = this.name
    return res
  }
}

/** Create a new type */
export function type<T extends Array<Section.Input>>(
  label: Label,
  ...sections: T
): TypeConfig<
  Section.RawFieldsOf<T[number]>,
  Section.TransformedFieldsOf<T[number]>
> {
  return new TypeConfig(label, sections.map(Section.from), {})
}
