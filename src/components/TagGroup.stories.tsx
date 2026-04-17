import {useListData} from 'react-stately'
import {Stack} from '../stories/Stack.tsx'
import {type IntentProps, type ShapeProps, Tag, TagGroup} from './TagGroup.tsx'

const intents: IntentProps[] = ['primary', 'secondary']
const shapes: ShapeProps[] = ['square', 'circle']

const items = [
  {id: 1, name: 'Chocolate'},
  {id: 2, name: 'Mint'},
  {id: 3, name: 'Strawberry'},
  {id: 4, name: 'Vanilla'}
]

export const Intents = () => (
  <Stack>
    {intents.map(intent => (
      <TagGroup items={items} label={intent} intent={intent} key={intent}>
        {item => <Tag>{item.name}</Tag>}
      </TagGroup>
    ))}
  </Stack>
)

export const Selection = () => {
  const list = useListData({
    initialItems: [
      {id: 1, name: 'Chocolate'},
      {id: 2, name: 'Mint'},
      {id: 3, name: 'Strawberry'},
      {id: 4, name: 'Vanilla', isDisabled: true}
    ]
  })

  return (
    <Stack>
      <TagGroup items={list.items} label="Ice cream flavor">
        {item => <Tag isDisabled={item.isDisabled}>{item.name}</Tag>}
      </TagGroup>
      <TagGroup
        items={list.items}
        label="Ice cream flavor"
        description="Multiple selectionMode"
        selectionMode="multiple"
        onRemove={keys => list.remove(...keys)}
      >
        {item => <Tag isDisabled={item.isDisabled}>{item.name}</Tag>}
      </TagGroup>
    </Stack>
  )
}

export const Shape = () => (
  <Stack>
    {shapes.map(shape => (
      <TagGroup items={items} label={shape} shape={shape} key={shape}>
        {item => <Tag>{item.name}</Tag>}
      </TagGroup>
    ))}
  </Stack>
)

export default {
  title: 'Components / TabGroup'
}
