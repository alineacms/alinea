import {Shape} from 'alinea/core/Shape'
import {ListShape} from 'alinea/core/shape/ListShape'
import {RecordShape} from 'alinea/core/shape/RecordShape'
import {RichTextShape} from 'alinea/core/shape/RichTextShape'
import {ScalarShape} from 'alinea/core/shape/ScalarShape'
import {UnionShape} from 'alinea/core/shape/UnionShape'
import {ComponentType} from 'react'
import {diffRecord} from './DiffUtils.js'
import {FieldsDiffProps} from './FieldsDiff.js'
import {ListDiff} from './ListDiff.js'
import {RichTextDiff} from './RichTextDiff.js'
import {ScalarDiff} from './ScalarDiff.js'

export type FieldDiffProps = {
  FieldsDiff: ComponentType<FieldsDiffProps>
  shape: Shape
  valueA: any
  valueB: any
}

export function FieldDiff({FieldsDiff, shape, valueA, valueB}: FieldDiffProps) {
  if (shape instanceof ScalarShape) {
    return <ScalarDiff valueA={valueA} valueB={valueB} />
  } else if (shape instanceof RichTextShape) {
    return (
      <RichTextDiff
        FieldsDiff={FieldsDiff}
        shape={shape}
        valueA={valueA}
        valueB={valueB}
      />
    )
  } else if (shape instanceof ListShape) {
    return (
      <ListDiff
        FieldsDiff={FieldsDiff}
        shape={shape}
        valueA={valueA}
        valueB={valueB}
      />
    )
  } else if (shape instanceof RecordShape) {
    const changes = diffRecord(shape as RecordShape, valueA, valueB)
    return <FieldsDiff changes={changes} targetA={valueA} targetB={valueB} />
  } else if (shape instanceof UnionShape) {
    console.warn('UnionShape not supported yet')
  }
  return null
}
