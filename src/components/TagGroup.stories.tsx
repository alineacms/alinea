import {useState} from 'react'
import {Tag, TagGroup} from './TagGroup.js'
import type {Key, Selection} from './types.js'

const flavors = [
  {id: 'chocolate', name: 'Chocolate'},
  {id: 'mint', name: 'Mint'},
  {id: 'strawberry', name: 'Strawberry'},
  {id: 'vanilla', name: 'Vanilla'}
]

export function Example() {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
      <TagGroup label="Primary">
        {flavors.map(flavor => (
          <Tag key={flavor.id} id={flavor.id}>
            {flavor.name}
          </Tag>
        ))}
      </TagGroup>
      <TagGroup label="Secondary" variant="secondary">
        {flavors.map(flavor => (
          <Tag key={flavor.id} id={flavor.id}>
            {flavor.name}
          </Tag>
        ))}
      </TagGroup>
      <TagGroup label="Circle" shape="circle">
        {flavors.map(flavor => (
          <Tag key={flavor.id} id={flavor.id}>
            {flavor.name}
          </Tag>
        ))}
      </TagGroup>
    </div>
  )
}

export function Selectable() {
  const [selected, setSelected] = useState<Selection>(new Set(['mint']))
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <TagGroup
        label="Ice cream flavor"
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        disabledKeys={['vanilla']}
      >
        {flavors.map(flavor => (
          <Tag key={flavor.id} id={flavor.id}>
            {flavor.name}
          </Tag>
        ))}
      </TagGroup>
      <p data-testid="state">
        {selected === 'all' ? 'all' : [...selected].join(',')}
      </p>
    </div>
  )
}

export function Removable() {
  const [items, setItems] = useState(flavors)
  function remove(keys: Set<Key>) {
    setItems(current => current.filter(item => !keys.has(item.id)))
  }
  return (
    <TagGroup
      label="Removable"
      description="Every tag has a remove button"
      onRemove={remove}
    >
      {items.map(item => (
        <Tag key={item.id} id={item.id}>
          {item.name}
        </Tag>
      ))}
    </TagGroup>
  )
}

export default {
  title: 'Pure components / TagGroup'
}
