'use client'

import {ComboBox, ComboBoxItem} from 'alinea/components'

export function ComboBoxExample() {
  return (
    <ComboBox label="Related product" defaultValue="chair" style={{width: 280}}>
      <ComboBoxItem value="shirt">Linen shirt</ComboBoxItem>
      <ComboBoxItem value="chair">Oak dining chair</ComboBoxItem>
      <ComboBoxItem value="throw">Wool throw</ComboBoxItem>
      <ComboBoxItem value="table">Walnut side table</ComboBoxItem>
    </ComboBox>
  )
}
