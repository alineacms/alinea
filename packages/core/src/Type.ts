// Todo: extract interface and place it in core
import type {Pages} from '@alinea/backend/Pages'
import type {EntryEditProps} from '@alinea/dashboard/view/EntryEdit'
import type {Cursor, Fields} from '@alinea/store'
import {Collection, Expr, SelectionInput} from '@alinea/store'
import type {ComponentType} from 'react'
import {Entry} from './Entry'
import {Field} from './Field'
import {createId} from './Id'
import {Label} from './Label'
import type {Schema} from './Schema'
import {Section} from './Section'
import {Shape} from './Shape'
import {RecordShape} from './shape/RecordShape'
import {Lazy} from './util/Lazy'
import {LazyRecord} from './util/LazyRecord'
import type {View} from './View'

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
  index?: <T>(fields: Fields<T>) => Record<string, Array<Expr<any>>>

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
    for (const section of this.sections)
      if (section.fields) Object.assign(this.fields, Lazy.get(section.fields))
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

  selection(cursor: Cursor<R>, pages: Pages<any>): Expr<any> | undefined {
    const computed: Record<string, SelectionInput> = {}
    let isComputed = false
    for (const [key, field] of this) {
      if (!field.transform) continue
      const selection = field.transform(cursor.get<any>(key), pages)
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
    return cursor.fields.with(computed).toExpr()
  }

  configure<Q = T>(options: TypeOptions<R, Q>): TypeConfig<R, Q> {
    return new TypeConfig<R, Q>(this.label, this.sections, {
      ...this.options,
      ...options
    } as TypeOptions<R, Q>)
  }

  toType(schema: Schema, name: string): Type<R, T> {
    return new Type(schema, name, this)
  }
}

/** Describes the structure of an entry by their fields and type */
export class Type<R = any, T = R> extends TypeConfig<R, T> {
  constructor(
    public schema: Schema,
    public name: string,
    config: TypeConfig<R, T>
  ) {
    super(config.label, config.sections, config.options)
  }

  /** Create a new Entry instance of this type */
  create() {
    return {
      ...this.empty(),
      type: this.name,
      id: createId()
    } as Entry & T
  }

  collection(): Collection<T> {
    const alias = this.name
    const fields = Entry
    const res = new Collection<T>('Entry', {
      where: fields.type
        .is(alias)
        .and(fields.alinea.workspace.is(this.schema.workspace.name))
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
