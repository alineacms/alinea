import {useListData} from 'react-stately'
import {Stack} from '../stories/Stack.tsx'
import {
  MultipleSelect,
  MultipleSelectItem,
  type SelectedKey
} from './MultipleSelect.tsx'
import {Tag} from './TagGroup.tsx'

export function Basic() {
  const emptyItems = useListData<SelectedKey>({
    initialItems: []
  })
  const selectedItems = useListData<SelectedKey>({
    initialItems: [fruits[0], fruits[1]]
  })
  return (
    <Stack>
      <MultipleSelect
        label="Fruits"
        selectedItems={emptyItems}
        items={fruits}
        tag={item => <Tag data-shape="circle">{item.name}</Tag>}
      >
        {item => {
          return (
            <MultipleSelectItem textValue={item.name}>
              {item.name}
            </MultipleSelectItem>
          )
        }}
      </MultipleSelect>
      <MultipleSelect
        label="Disabled"
        selectedItems={selectedItems}
        items={fruits}
        tag={item => (
          <Tag isDisabled data-shape="circle">
            {item.name}
          </Tag>
        )}
        isDisabled
        description="isDisabled"
      >
        {item => {
          return (
            <MultipleSelectItem textValue={item.name}>
              {item.name}
            </MultipleSelectItem>
          )
        }}
      </MultipleSelect>
    </Stack>
  )
}

const fruits = [
  {id: 1, name: 'Apple'},
  {id: 2, name: 'Banana'},
  {id: 3, name: 'Cherry'},
  {id: 4, name: 'Date'},
  {id: 5, name: 'Elderberry'},
  {id: 6, name: 'Fig'},
  {id: 7, name: 'Grape'},
  {id: 8, name: 'Honeydew'},
  {id: 9, name: 'Kiwi'},
  {id: 10, name: 'Lemon'},
  {id: 11, name: 'Mango'},
  {id: 12, name: 'Nectarine'},
  {id: 13, name: 'Orange'},
  {id: 14, name: 'Papaya'},
  {id: 15, name: 'Quince'},
  {id: 16, name: 'Raspberry'},
  {id: 17, name: 'Strawberry'},
  {id: 18, name: 'Tangerine'},
  {id: 19, name: 'Ugli Fruit'},
  {id: 20, name: 'Watermelon'},
  {id: 21, name: 'Dragonfruit'},
  {id: 22, name: 'Durian'},
  {id: 23, name: 'Jackfruit'},
  {id: 24, name: 'Kiwano'},
  {id: 25, name: 'Langsat'},
  {id: 26, name: 'Mangosteen'},
  {id: 27, name: 'Miracle Fruit'},
  {id: 28, name: 'Rambutan'},
  {id: 29, name: 'Salak'},
  {id: 30, name: 'Soursop'}
]

export default {
  title: 'Components / MultipleSelect'
}
