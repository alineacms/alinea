import {Shape} from 'alinea/core/Shape'
import {ListShape} from 'alinea/core/shape/ListShape'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {RichTextShape} from 'alinea/core/shape/RichTextShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {UnionShape} from 'alinea/core/shape/UnionShape'
import {diffRecord} from './DiffUtils.js'
import {FieldsDiff} from './FieldsDiff.js'
import {ListDiff} from './ListDiff.js'
import {RichTextDiff} from './RichTextDiff.js'
import {ScalarDiff} from './ScalarDiff.js'

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
  } else if (shape instanceof UnionShape) {
    console.warn('UnionShape not supported yet')
  }
  return null
}
