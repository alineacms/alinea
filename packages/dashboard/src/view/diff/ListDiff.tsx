import {ListRow, ListValue} from '@alinea/core/value/ListValue'
import {Card} from '@alinea/ui'
import {ChangeBox} from './ChangeBox'
import {diffList} from './Equals'
import {FieldDiff} from './FieldDiff'

export type ListDiffProps = {
  type: ListValue<any>
  valueA: Array<ListRow>
  valueB: Array<ListRow>
}

export function ListDiff({type, valueA, valueB}: ListDiffProps) {
  const equals = (itemA: ListRow, itemB: ListRow) => {
    return itemA.id === itemB.id
  }
  const changes = diffList(valueA, valueB, equals)
  return (
    <Card.Root>
      {changes.map((change, i) => {
        const block = change.value
        const kind = type.values[block.type]
        return (
          <Card.Row key={i}>
            <ChangeBox change={change.type}>
              <FieldDiff
                type={kind}
                valueA={change.type === 'unchanged' ? change.old : change.value}
                valueB={change.value}
              />
            </ChangeBox>
          </Card.Row>
        )
      })}
    </Card.Root>
  )
}
