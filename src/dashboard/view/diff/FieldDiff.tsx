import type {Shape} from '#/core/Shape.js'
import {ListShape} from '#/core/shape/ListShape.js'
import {RecordShape} from '#/core/shape/RecordShape.js'
import {RichTextShape} from '#/core/shape/RichTextShape.js'
import {ScalarShape} from '#/core/shape/ScalarShape.js'
import {UnionShape} from '#/core/shape/UnionShape.js'
import type {ComponentType} from 'react'
import {diffRecord} from './DiffUtils.js'
import type {FieldsDiffProps} from './FieldsDiff.js'
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
  }if (shape instanceof RichTextShape) {
    return (
      <RichTextDiff
        FieldsDiff={FieldsDiff}
        shape={shape}
        valueA={valueA}
        valueB={valueB}
      />
    )
  }if (shape instanceof ListShape) {
    return (
      <ListDiff
        FieldsDiff={FieldsDiff}
        shape={shape}
        valueA={valueA}
        valueB={valueB}
      />
    )
  }if (shape instanceof RecordShape) {
    const changes = diffRecord(shape as RecordShape, valueA, valueB)
    return <FieldsDiff changes={changes} targetA={valueA} targetB={valueB} />
  }if (shape instanceof UnionShape) {
    console.warn('UnionShape not supported yet')
  }
  return null
}
