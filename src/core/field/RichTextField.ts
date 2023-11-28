import {RichTextMutator, RichTextShape} from 'alinea/core'
import {Field, FieldMeta} from '../Field.js'
import {TextDoc} from '../TextDoc.js'
import {RecordShape} from '../shape/RecordShape.js'

export class RichTextField<Blocks, Options> extends Field<
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
