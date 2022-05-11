import {RichTextValue, Value} from '@alinea/core'
import {ListValue} from '@alinea/core/value/ListValue'
import {RecordValue} from '@alinea/core/value/RecordValue'
import {ValueKind} from '@alinea/core/ValueKind'
import {diffRecord} from './DiffUtils'
import {FieldsDiff} from './FieldsDiff'
import {ListDiff} from './ListDiff'
import {RichTextDiff} from './RichTextDiff'
import {ScalarDiff} from './ScalarDiff'

export type FieldDiffProps = {
  type: Value
  valueA: any
  valueB: any
}

export function FieldDiff({type, valueA, valueB}: FieldDiffProps) {
  if (type.kind === ValueKind.Scalar) {
    return <ScalarDiff valueA={valueA} valueB={valueB} />
  } else if (type.kind === ValueKind.RichText) {
    return (
      <RichTextDiff
        type={type as RichTextValue<any>}
        valueA={valueA}
        valueB={valueB}
      />
    )
  } else if (type.kind === ValueKind.List) {
    return (
      <ListDiff type={type as ListValue<any>} valueA={valueA} valueB={valueB} />
    )
  } else if (type.kind === ValueKind.Record) {
    const changes = diffRecord(type as RecordValue, valueA, valueB)
    return <FieldsDiff changes={changes} targetA={valueA} targetB={valueB} />
  }
  return null
}
