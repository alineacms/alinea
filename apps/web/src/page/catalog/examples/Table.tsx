'use client'

import {
  Badge,
  Table,
  TableCell,
  TableRow,
  TableThumbnail,
  TableTitle
} from 'alinea/components'

const products = [
  {id: 'oak-dining-chair', title: 'Oak dining chair', status: 'published'},
  {id: 'walnut-stools', title: 'Walnut stools', status: 'draft'},
  {id: 'linen-lounge-chair', title: 'Linen lounge chair', status: 'archived'}
] as const

export function TableExample() {
  return (
    <div style={{width: 520, height: 180}}>
      <Table
        aria-label="Products"
        items={products}
        columns={[
          {id: 'image', header: 'Image', width: 72},
          {id: 'title', header: 'Title', width: '1fr'},
          {id: 'status', header: 'Status', width: 120}
        ]}
      >
        {product => (
          <TableRow id={product.id} textValue={product.title}>
            <TableThumbnail src={`/catalog/${product.id}.jpg`} alt="" />
            <TableTitle title={product.title} label="Products" />
            <TableCell>
              <Badge size="sm" status={product.status}>
                {product.status}
              </Badge>
            </TableCell>
          </TableRow>
        )}
      </Table>
    </div>
  )
}
