import {useMemo, useState} from 'react'
import {Button} from './Button.js'
import {
  ContentTable,
  type ContentTableColumn,
  ContentTableCell,
  ContentTableRow,
  ContentTableTitle
} from './ContentTable.js'
import type {Key, Selection, SortDescriptor} from './types.js'

interface Product {
  id: string
  title: string
  sku: string
  category: string
  price: number
  stock: number
  updated: string
  color: string
  variants?: Array<Product>
}

function thumbnail(color: string, label: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/><text x="32" y="40" font-family="sans-serif" font-size="22" font-weight="600" fill="white" text-anchor="middle">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const products: Array<Product> = [
  {
    id: 'chair',
    title: 'Lounge chair',
    sku: 'FUR-001',
    category: 'Furniture',
    price: 649,
    stock: 12,
    updated: '2026-09-18',
    color: '#8b5cf6',
    variants: [
      {
        id: 'chair-oak',
        title: 'Lounge chair, oak',
        sku: 'FUR-001-OAK',
        category: 'Furniture',
        price: 649,
        stock: 8,
        updated: '2026-09-18',
        color: '#a16207'
      },
      {
        id: 'chair-walnut',
        title: 'Lounge chair, walnut',
        sku: 'FUR-001-WAL',
        category: 'Furniture',
        price: 699,
        stock: 4,
        updated: '2026-09-12',
        color: '#78350f'
      }
    ]
  },
  {
    id: 'lamp',
    title: 'Desk lamp',
    sku: 'LIG-014',
    category: 'Lighting',
    price: 129,
    stock: 0,
    updated: '2026-09-20',
    color: '#f59e0b'
  },
  {
    id: 'rug',
    title: 'Wool rug',
    sku: 'TEX-203',
    category: 'Textiles',
    price: 349,
    stock: 23,
    updated: '2026-08-30',
    color: '#0ea5e9'
  },
  {
    id: 'vase',
    title: 'Ceramic vase',
    sku: 'DEC-077',
    category: 'Decoration',
    price: 59,
    stock: 41,
    updated: '2026-09-02',
    color: '#10b981'
  }
]

const columns: Array<ContentTableColumn> = [
  {id: 'title', header: 'Product', width: '2fr', minWidth: 260, sortable: true},
  {id: 'category', header: 'Category', width: '1fr', minWidth: 120},
  {id: 'price', header: 'Price', width: 110, align: 'end', sortable: true},
  {id: 'stock', header: 'Stock', width: 110, align: 'end', sortable: true},
  {id: 'updated', header: 'Updated', width: 140, sortable: true}
]

const currency = new Intl.NumberFormat('en', {
  style: 'currency',
  currency: 'EUR'
})
const date = new Intl.DateTimeFormat('en', {dateStyle: 'medium'})

function sortProducts(items: Array<Product>, sort: SortDescriptor) {
  const key = sort.column as keyof Product
  const sorted = [...items].sort((a, b) => {
    const left = a[key] ?? ''
    const right = b[key] ?? ''
    return left < right ? -1 : left > right ? 1 : 0
  })
  return sort.direction === 'asc' ? sorted : sorted.reverse()
}

function ProductRow({product}: {product: Product}) {
  return (
    <ContentTableRow
      id={product.id}
      textValue={product.title}
      hasChildren={Boolean(product.variants)}
      rows={product.variants?.map(variant => (
        <ProductRow key={variant.id} product={variant} />
      ))}
    >
      <ContentTableTitle
        image={thumbnail(product.color, product.title[0])}
        title={product.title}
        description={product.sku}
      />
      <ContentTableCell>{product.category}</ContentTableCell>
      <ContentTableCell align="end">
        {currency.format(product.price)}
      </ContentTableCell>
      <ContentTableCell align="end">
        {product.stock === 0 ? 'Sold out' : product.stock}
      </ContentTableCell>
      <ContentTableCell>
        {date.format(new Date(product.updated))}
      </ContentTableCell>
    </ContentTableRow>
  )
}

/**
 * A custom root view, as configured with `Config.root({view})`, that lists
 * the root's entries with its own columns.
 */
export function CustomRootView() {
  const [sort, setSort] = useState<SortDescriptor>({
    column: 'title',
    direction: 'asc'
  })
  const [selected, setSelected] = useState<Selection>(new Set())
  const [opened, setOpened] = useState<Key | null>(null)
  const items = useMemo(() => sortProducts(products, sort), [sort])
  const count = selected === 'all' ? products.length : selected.size
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        height: 480,
        padding: 16
      }}
    >
      <header style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <div style={{flex: 1}}>
          <h1 style={{margin: 0, fontSize: 20}}>Products</h1>
          <p style={{margin: 0, color: 'var(--alinea-fg-muted)'}}>
            {opened ? `Opened ${opened}` : `${products.length} products`}
          </p>
        </div>
        <Button variant="outline" disabled={count === 0}>
          Archive {count > 0 ? count : ''}
        </Button>
        <Button color="primary">New product</Button>
      </header>
      <ContentTable
        aria-label="Products"
        items={items}
        columns={columns}
        expandable
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        sortDescriptor={sort}
        onSortChange={setSort}
        onRowAction={setOpened}
      >
        {product => <ProductRow product={product} />}
      </ContentTable>
    </div>
  )
}

export function WithoutHeader() {
  return (
    <div style={{height: 260, padding: 16}}>
      <ContentTable
        aria-label="Products"
        items={products}
        columns={columns}
        showHeader={false}
      >
        {product => <ProductRow product={product} />}
      </ContentTable>
    </div>
  )
}

export function Empty() {
  return (
    <div style={{height: 200, padding: 16}}>
      <ContentTable
        aria-label="Products"
        items={[]}
        columns={columns}
        renderEmptyState={() => 'No products yet'}
      >
        {(product: Product) => <ProductRow product={product} />}
      </ContentTable>
    </div>
  )
}

export default {
  title: 'Pure components / ContentTable'
}
