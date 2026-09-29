'use client'

import {
  type SortDescriptor,
  Table,
  TableCell,
  TableRow,
  TableTitle
} from 'alinea/components'
import {useState} from 'react'

const products = [
  {id: 'shirt', title: 'Linen shirt', price: 89},
  {id: 'chair', title: 'Oak dining chair', price: 245},
  {id: 'stool', title: 'Walnut stool', price: 160},
  {id: 'lamp', title: 'Ceramic table lamp', price: 120}
]

export function TableSelectionExample() {
  const [sort, setSort] = useState<SortDescriptor>({
    column: 'title',
    direction: 'asc'
  })
  const sorted = [...products].sort((a, b) =>
    sort.column === 'price' ? a.price - b.price : a.title.localeCompare(b.title)
  )
  if (sort.direction === 'desc') sorted.reverse()
  return (
    <div style={{width: 520, height: 230}}>
      <Table
        aria-label="Products"
        items={sorted}
        columns={[
          {id: 'title', header: 'Title', width: '1fr', sortable: true},
          {
            id: 'price',
            header: 'Price',
            width: 120,
            align: 'end',
            sortable: true
          }
        ]}
        selectionMode="multiple"
        showSelectionControls
        defaultSelectedKeys={new Set(['chair'])}
        sortDescriptor={sort}
        onSortChange={setSort}
      >
        {product => (
          <TableRow id={product.id} textValue={product.title}>
            <TableTitle title={product.title} />
            <TableCell align="end">€{product.price}</TableCell>
          </TableRow>
        )}
      </Table>
    </div>
  )
}
