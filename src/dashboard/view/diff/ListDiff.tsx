import {ListRow, ListShape} from 'alinea/core/shape/ListShape'
import {Sink} from 'alinea/ui'
import {ChangeBox} from './ChangeBox.js'
import {diffList, diffRecord} from './DiffUtils.js'
import {FieldsDiff} from './FieldsDiff.js'

export type ListDiffProps = {
  shape: ListShape<any>
  valueA: Array<ListRow>
  valueB: Array<ListRow>
}

export function ListDiff({shape, valueA, valueB}: ListDiffProps) {
  const equals = (itemA: ListRow, itemB: ListRow) => {
    return itemA.id === itemB.id
  }
  const changes = diffList(valueA || [], valueB || [], equals)
  return (
    <Sink.Root>
      {changes.map((change, i) => {
        const block = change.value
        const kind = shape.values[block.type]
        const compare =
          change.type === 'unchanged'
            ? [change.old, change.value]
            : change.type === 'removal'
            ? [change.value, {}]
            : [{}, change.value]
        const changes = diffRecord(kind, compare[0], compare[1])
        if (changes.length === 0) return <ChangeBox change="equal" key={i} />
        return (
          <ChangeBox change={change.type} key={i}>
            <FieldsDiff
              changes={changes}
              targetA={compare[0]}
              targetB={compare[1]}
            />
          </ChangeBox>
        )
      })}
    </Sink.Root>
  )
}
