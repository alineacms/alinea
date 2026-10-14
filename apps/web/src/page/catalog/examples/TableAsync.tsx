'use client'

import {
  Table,
  TableCell,
  TableRow,
  TableTitle,
  useAsyncList
} from 'alinea/components'

interface Product {
  id: string
  title: string
  price: number
}

const materials = ['Linen', 'Oak', 'Wool', 'Walnut', 'Ceramic']
const kinds = ['shirt', 'chair', 'throw', 'stool', 'lamp', 'table']

// Stands in for a paged API: 20 products per page, 100 in total
async function fetchProducts(page: number) {
  await new Promise(resolve => setTimeout(resolve, 500))
  const items: Array<Product> = Array.from({length: 20}, (_, i) => {
    const n = page * 20 + i
    const title = `${materials[n % 5]} ${kinds[n % 6]} ${n + 1}`
    return {id: `product-${n}`, title, price: 40 + ((n * 37) % 300)}
  })
  return {items, cursor: page < 4 ? page + 1 : undefined}
}

export function TableAsyncExample() {
  const list = useAsyncList<Product, number>({
    load: ({cursor = 0}) => fetchProducts(cursor)
  })
  return (
    <div style={{width: 420, height: 260}}>
      <Table
        aria-label="Products"
        items={list.items}
        columns={[
          {id: 'title', header: 'Title', width: '1fr'},
          {id: 'price', header: 'Price', width: 100, align: 'end'}
        ]}
        loading={list.loading}
        onLoadMore={list.loadMore}
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
