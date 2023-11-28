import {Field, FieldMeta} from '../Field.js'
import {ListMutator, ListRow, ListShape} from '../shape/ListShape.js'
import {RecordShape} from '../shape/RecordShape.js'

export class ListField<Schema, Options> extends Field<
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
