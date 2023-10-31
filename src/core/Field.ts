import {LinkResolver} from 'alinea/backend/resolver/LinkResolver'
import {Expr} from 'alinea/core/pages/Expr'
import {InputState} from 'alinea/editor'
import type {ComponentType} from 'react'
import {Hint} from './Hint.js'
import {Label} from './Label.js'
import {Shape} from './Shape.js'
import {TextDoc} from './TextDoc.js'
import {ListMutator, ListRow, ListShape} from './shape/ListShape.js'
import {RecordMutator, RecordShape} from './shape/RecordShape.js'
import {RichTextMutator, RichTextShape} from './shape/RichTextShape.js'
import {ScalarShape} from './shape/ScalarShape.js'
import {UnionMutator, UnionRow, UnionShape} from './shape/UnionShape.js'

export interface FieldOptions {
  hidden?: boolean
  readonly?: boolean
}

export interface FieldMeta<Value, OnChange, Options> {
  hint: Hint
  label: Label
  initialValue?: Value
  options: Options
  view?: FieldView<Value, OnChange, Options>
  postProcess?: (value: Value, loader: LinkResolver) => Promise<void>
}

export interface FieldData<Value, OnChange, Options>
  extends FieldMeta<Value, OnChange, Options> {
  shape: Shape<Value, OnChange>
}

export type FieldView<Value, OnChange, Options> = ComponentType<{
  state: InputState<readonly [Value, OnChange]>
  field: Field<Value, OnChange, Options>
}>

export interface Field<Value, OnChange, Options> extends Expr<Value> {
  [Field.Data]: FieldData<Value, OnChange, Options>
}

export class Field<Value = unknown, OnChange = unknown, Options = {}> {
  constructor(data: FieldData<Value, OnChange, Options>) {
    this[Field.Data] = data
  }
}

export namespace Field {
  export const Data = Symbol.for('@alinea/Field.Data')

  export class Scalar<Value, Options> extends Field<
    Value,
    (value: Value) => void,
    Options
  > {
    constructor(meta: FieldMeta<Value, (value: Value) => void, Options>) {
      super({
        shape: new ScalarShape(meta.label, meta.initialValue),
        ...meta
      })
    }
  }

  export class List<Schema, Options> extends Field<
    Array<ListRow & Schema>,
    ListMutator<ListRow & Schema>,
    Options
  > {
    constructor(
      shape: {[key: string]: RecordShape<any>},
      meta: FieldMeta<
        Array<ListRow & Schema>,
        ListMutator<ListRow & Schema>,
        Options
      >
    ) {
      super({
        shape: new ListShape(
          meta.label,
          shape,
          meta.initialValue,
          meta.postProcess
        ),
        ...meta
      })
    }
  }

  export class Union<Row, Options> extends Field<
    UnionRow & Row,
    UnionMutator<Row>,
    Options
  > {
    constructor(
      shapes: {[key: string]: RecordShape<any>},
      meta: FieldMeta<UnionRow & Row, UnionMutator<Row>, Options>
    ) {
      super({
        shape: new UnionShape<Row>(
          meta.label,
          shapes,
          meta.initialValue,
          meta.postProcess
        ),
        ...meta
      })
    }
  }

  export class Record<Row, Options> extends Field<
    Row,
    RecordMutator<Row>,
    Options
  > {
    constructor(
      shape: RecordShape<any>,
      meta: FieldMeta<Row, RecordMutator<Row>, Options>
    ) {
      super({shape, ...meta})
    }
  }

  export class RichText<Blocks, Options> extends Field<
    TextDoc<Blocks>,
    RichTextMutator<Blocks>,
    Options
  > {
    constructor(
      shape: {[key: string]: RecordShape<any>} | undefined,
      meta: FieldMeta<TextDoc<Blocks>, RichTextMutator<Blocks>, Options>
    ) {
      super({
        shape: new RichTextShape(meta.label, shape, meta.initialValue),
        ...meta
      })
    }
  }

  export function provideView<
    Value,
    OnChange,
    Options,
    Factory extends (...args: Array<any>) => Field<Value, OnChange, Options>
  >(view: FieldView<Value, OnChange, Options>, factory: Factory): Factory {
    return ((...args: Array<any>) =>
      new Field({...factory(...args)[Field.Data], view})) as Factory
  }

  export function shape(field: Field<any, any>): Shape {
    return field[Field.Data].shape
  }

  export function hint(field: Field): Hint {
    return field[Field.Data].hint
  }

  export function view<Value, OnChange, Options>(
    field: Field<Value, OnChange, Options>
  ): FieldView<Value, OnChange, Options> | undefined {
    return field[Field.Data].view
  }

  export function options(field: Field): FieldOptions {
    return field[Field.Data].options
  }

  export function isField(value: any): value is Field {
    return value && Boolean(value[Field.Data])
  }
}
