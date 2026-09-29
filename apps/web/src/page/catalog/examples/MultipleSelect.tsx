'use client'

import {MultipleSelect, MultipleSelectItem} from 'alinea/components'

export function MultipleSelectExample() {
  return (
    <MultipleSelect
      label="Materials"
      defaultValue={['linen', 'oak']}
      style={{width: 300}}
    >
      <MultipleSelectItem value="linen">Linen</MultipleSelectItem>
      <MultipleSelectItem value="oak">Oak</MultipleSelectItem>
      <MultipleSelectItem value="wool">Wool</MultipleSelectItem>
      <MultipleSelectItem value="walnut">Walnut</MultipleSelectItem>
    </MultipleSelect>
  )
}
