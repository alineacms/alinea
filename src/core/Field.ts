import {Expr} from 'alinea/backend2/pages/Expr'
import {InputState} from 'alinea/editor'
import type {ComponentType} from 'react'
import {Hint} from './Hint.js'
import {Label} from './Label.js'
import {Shape} from './Shape.js'
import {TextDoc} from './TextDoc.js'
import {ListMutator} from './shape/ListShape.js'
import {RecordMutator, RecordShape} from './shape/RecordShape.js'
import {RichTextMutator} from './shape/RichTextShape.js'

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

  attachView(view: FieldView<Value, OnChange, Options>): this {
    return new Field<Value, OnChange, Options>({
      ...this[Field.Data],
      view
    }) as this
  }
}

export namespace Field {
  export const Data = Symbol('Field.Data')

  export class Scalar<Value, Options> extends Field<
    Value,
    (value: Value) => void,
    Options
  > {
    constructor(meta: FieldMeta<Value, (value: Value) => void, Options>) {
      super({shape: Shape.Scalar(meta.label, meta.initialValue), ...meta})
    }
  }

  export class List<Row, Options> extends Field<
    Array<Row>,
    ListMutator<Row>,
    Options
  > {
    constructor(
      shape: {[key: string]: RecordShape<any>},
      meta: FieldMeta<Array<Row>, ListMutator<Row>, Options>
    ) {
      super({shape: Shape.List(meta.label, shape, meta.initialValue), ...meta})
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
        shape: Shape.RichText(meta.label, shape, meta.initialValue),
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
      factory(...args).attachView(view)) as Factory
  }

  export function shape(field: Field<any, any>) {
    return field[Field.Data].shape
  }
}
