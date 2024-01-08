import {Field, FieldMeta, FieldOptions} from '../Field.js'
import {ListMutator, ListRow, ListShape} from '../shape/ListShape.js'
import {RecordShape} from '../shape/RecordShape.js'

export class ListField<
  Row extends ListRow,
  Options extends FieldOptions<Array<Row>>
> extends Field<Array<Row>, ListMutator<Row>, Options> {
  constructor(
    shape: {[key: string]: RecordShape<any>},
    meta: FieldMeta<Array<Row>, ListMutator<Row>, Options>
  ) {
    super({
      shape: new ListShape(
        meta.options.label,
        shape,
        meta.options.initialValue,
        meta.postProcess
      ),
      ...meta
    })
  }
}
