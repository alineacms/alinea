'use client'

import {ComboBox, ComboBoxItem, useAsyncList} from 'alinea/components'

const products = [
  {id: 'shirt', title: 'Linen shirt'},
  {id: 'chair', title: 'Oak dining chair'},
  {id: 'throw', title: 'Wool throw'},
  {id: 'table', title: 'Walnut side table'},
  {id: 'lamp', title: 'Ceramic table lamp'}
]

// Stands in for a search request to your own API
async function searchProducts(text: string) {
  await new Promise(resolve => setTimeout(resolve, 400))
  const query = text.toLowerCase()
  return products.filter(product => product.title.toLowerCase().includes(query))
}

export function ComboBoxAsyncExample() {
  const list = useAsyncList({
    async load({filterText}) {
      return {items: await searchProducts(filterText)}
    }
  })
  return (
    <ComboBox
      label="Related product"
      inputValue={list.filterText}
      onInputValueChange={list.setFilterText}
      filter={false}
      loading={list.loading}
      emptyMessage="No products found"
      style={{width: 280}}
    >
      {list.items.map(product => (
        <ComboBoxItem key={product.id} value={product.id}>
          {product.title}
        </ComboBoxItem>
      ))}
    </ComboBox>
  )
}
