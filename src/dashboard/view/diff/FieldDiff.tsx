import {RichTextShape, Shape} from 'alinea/core'
import {ListShape} from 'alinea/core/shape/ListShape'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {diffRecord} from './DiffUtils'
import {FieldsDiff} from './FieldsDiff'
import {ListDiff} from './ListDiff'
import {RichTextDiff} from './RichTextDiff'
import {ScalarDiff} from './ScalarDiff'

export type FieldDiffProps = {
  shape: Shape
  valueA: any
  valueB: any
}

export function FieldDiff({shape, valueA, valueB}: FieldDiffProps) {
  if (shape instanceof ScalarShape) {
    return <ScalarDiff valueA={valueA} valueB={valueB} />
  } else if (shape instanceof RichTextShape) {
    return <RichTextDiff shape={shape} valueA={valueA} valueB={valueB} />
  } else if (shape instanceof ListShape) {
    return <ListDiff shape={shape} valueA={valueA} valueB={valueB} />
  } else if (shape instanceof RecordShape) {
    const changes = diffRecord(shape as RecordShape, valueA, valueB)
    return <FieldsDiff changes={changes} targetA={valueA} targetB={valueB} />
  }
  return null
}
